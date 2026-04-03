-- schema-v16.sql
-- Système d'échange de points : tables rewards + redemptions + RPC atomiques
-- À exécuter dans Supabase → SQL Editor → New query → Run

-- ── 1. Table rewards ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rewards (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  emoji       text        NOT NULL DEFAULT '🎁',
  name        text        NOT NULL,
  description text,
  points_cost integer     NOT NULL CHECK (points_cost > 0),
  stock       integer,    -- NULL = illimité
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rewards_select" ON rewards;
CREATE POLICY "rewards_select" ON rewards FOR SELECT USING (true);

DROP POLICY IF EXISTS "rewards_admin" ON rewards;
CREATE POLICY "rewards_admin" ON rewards FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin'));

-- ── 2. Table redemptions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS redemptions (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_id      uuid        NOT NULL REFERENCES rewards(id),
  points_spent   integer     NOT NULL,
  qr_code        text        UNIQUE NOT NULL,
  qr_expires_at  timestamptz NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'used', 'expired')),
  validated_by   uuid        REFERENCES profiles(id),
  validated_at   timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "redemptions_select" ON redemptions;
CREATE POLICY "redemptions_select" ON redemptions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin')
  );

DROP POLICY IF EXISTS "redemptions_insert" ON redemptions;
CREATE POLICY "redemptions_insert" ON redemptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "redemptions_update" ON redemptions;
CREATE POLICY "redemptions_update" ON redemptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin'));

-- ── 3. RPC : create_redemption (atomique, SECURITY DEFINER) ──────────────────

CREATE OR REPLACE FUNCTION create_redemption(p_user_id uuid, p_reward_id uuid)
RETURNS json AS $$
DECLARE
  v_reward  rewards%ROWTYPE;
  v_balance integer;
  v_token   text;
BEGIN
  -- Sécurité : l'appelant doit être le propriétaire des points
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Verrouille la récompense pour éviter les conditions de course
  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'reward_not_found');
  END IF;

  -- Vérifie le stock
  IF v_reward.stock IS NOT NULL AND v_reward.stock <= 0 THEN
    RETURN json_build_object('error', 'out_of_stock');
  END IF;

  -- Verrouille et vérifie le solde
  SELECT points_balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_balance < v_reward.points_cost THEN
    RETURN json_build_object(
      'error', 'insufficient_points',
      'balance', v_balance,
      'required', v_reward.points_cost
    );
  END IF;

  -- Débite les points
  UPDATE profiles
    SET points_balance = points_balance - v_reward.points_cost
    WHERE id = p_user_id;

  -- Décrémente le stock si limité
  IF v_reward.stock IS NOT NULL THEN
    UPDATE rewards SET stock = stock - 1 WHERE id = p_reward_id;
  END IF;

  -- Génère un token unique (16 caractères hex majuscules)
  LOOP
    v_token := upper(encode(gen_random_bytes(8), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM redemptions WHERE qr_code = v_token);
  END LOOP;

  -- Crée l'échange
  INSERT INTO redemptions (user_id, reward_id, points_spent, qr_code, qr_expires_at, status)
  VALUES (p_user_id, p_reward_id, v_reward.points_cost, v_token, now() + interval '5 minutes', 'pending');

  -- Entrée dans points_history
  INSERT INTO points_history (user_id, amount, reason)
  VALUES (p_user_id, -v_reward.points_cost, 'Échange : ' || v_reward.name);

  RETURN json_build_object(
    'success', true,
    'qr_code', v_token,
    'expires_at', (now() + interval '5 minutes'),
    'reward_name', v_reward.name,
    'reward_emoji', v_reward.emoji,
    'points_spent', v_reward.points_cost,
    'new_balance', v_balance - v_reward.points_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. RPC : validate_redemption (atomique, SECURITY DEFINER) ────────────────

CREATE OR REPLACE FUNCTION validate_redemption(p_token text, p_admin_id uuid)
RETURNS json AS $$
DECLARE
  v_redemp redemptions%ROWTYPE;
  v_user   profiles%ROWTYPE;
  v_reward rewards%ROWTYPE;
BEGIN
  -- Sécurité : doit être admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin') THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Trouve l'échange en verrouillant la ligne
  SELECT * INTO v_redemp FROM redemptions WHERE qr_code = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_redemp.status = 'used' THEN
    RETURN json_build_object('error', 'already_used');
  END IF;

  IF v_redemp.qr_expires_at < now() THEN
    UPDATE redemptions SET status = 'expired' WHERE id = v_redemp.id;
    RETURN json_build_object('error', 'expired');
  END IF;

  -- Marque comme utilisé
  UPDATE redemptions
    SET status = 'used', validated_by = p_admin_id, validated_at = now()
    WHERE id = v_redemp.id;

  -- Récupère les infos
  SELECT * INTO v_user   FROM profiles WHERE id = v_redemp.user_id;
  SELECT * INTO v_reward FROM rewards  WHERE id = v_redemp.reward_id;

  RETURN json_build_object(
    'success', true,
    'student_name',  v_user.full_name,
    'student_code',  v_user.student_code,
    'reward_name',   v_reward.name,
    'reward_emoji',  v_reward.emoji,
    'points_spent',  v_redemp.points_spent
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Données de départ ──────────────────────────────────────────────────────

INSERT INTO rewards (emoji, name, description, points_cost, is_active) VALUES
  ('🍺', 'Boisson offerte',  'Une boisson au choix chez le bar partenaire', 200, true),
  ('🎁', 'Goodies BDE',      'Sweat ou tote bag ECM Dijon',                 300, true),
  ('🎟️', 'Entrée soirée',    'Accès à une soirée thématique BDE',           500, true)
ON CONFLICT DO NOTHING;
