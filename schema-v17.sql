-- schema-v17.sql
-- Système de coupons : tables + RPC atomiques
-- Exécuter dans Supabase → SQL Editor → New query → Run

-- ── 1. Table coupons ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  emoji          text        NOT NULL DEFAULT '🎟️',
  title          text        NOT NULL,
  description    text,
  available_from timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  target         text        NOT NULL DEFAULT 'all' CHECK (target IN ('all', 'specific')),
  created_by     uuid        REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons_select" ON coupons;
CREATE POLICY "coupons_select" ON coupons FOR SELECT USING (true);

DROP POLICY IF EXISTS "coupons_admin" ON coupons;
CREATE POLICY "coupons_admin" ON coupons FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin'));

-- ── 2. Table coupon_assignments ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupon_assignments (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id     uuid        NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'used', 'expired')),
  qr_code       text        UNIQUE,
  qr_expires_at timestamptz,
  validated_by  uuid        REFERENCES profiles(id),
  used_at       timestamptz,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(coupon_id, user_id)
);

ALTER TABLE coupon_assignments ENABLE ROW LEVEL SECURITY;

-- Étudiant : voit ses propres coupons. Admin : voit tout.
DROP POLICY IF EXISTS "coupon_assignments_select" ON coupon_assignments;
CREATE POLICY "coupon_assignments_select" ON coupon_assignments FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin')
  );

-- Seul l'admin peut créer des assignments
DROP POLICY IF EXISTS "coupon_assignments_insert" ON coupon_assignments;
CREATE POLICY "coupon_assignments_insert" ON coupon_assignments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin'));

-- Étudiant peut update le sien (génération QR via RPC). Admin peut tout update.
DROP POLICY IF EXISTS "coupon_assignments_update" ON coupon_assignments;
CREATE POLICY "coupon_assignments_update" ON coupon_assignments FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin')
  );

-- ── 3. RPC : use_coupon (génère ou réutilise le QR, SECURITY DEFINER) ─────────

CREATE OR REPLACE FUNCTION use_coupon(p_user_id uuid, p_assignment_id uuid)
RETURNS json AS $$
DECLARE
  v_asgn   coupon_assignments%ROWTYPE;
  v_coupon coupons%ROWTYPE;
  v_token  text;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_asgn
  FROM coupon_assignments
  WHERE id = p_assignment_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_asgn.status = 'used' THEN
    RETURN json_build_object('error', 'already_used');
  END IF;

  SELECT * INTO v_coupon FROM coupons WHERE id = v_asgn.coupon_id;

  IF v_coupon.expires_at < now() THEN
    UPDATE coupon_assignments SET status = 'expired' WHERE id = p_assignment_id;
    RETURN json_build_object('error', 'expired');
  END IF;

  IF v_coupon.available_from > now() THEN
    RETURN json_build_object('error', 'not_yet_available');
  END IF;

  -- Réutilise le QR s'il est encore valide (5 min pas écoulées)
  IF v_asgn.qr_code IS NOT NULL AND v_asgn.qr_expires_at > now() THEN
    RETURN json_build_object(
      'success',    true,
      'qr_code',    v_asgn.qr_code,
      'expires_at', v_asgn.qr_expires_at,
      'title',      v_coupon.title,
      'emoji',      v_coupon.emoji
    );
  END IF;

  -- Génère un token unique : préfixe CPN + 16 hex = 19 chars
  -- Le préfixe CPN distingue ce token d'un token de récompense (hex pur)
  LOOP
    v_token := 'CPN' || upper(encode(gen_random_bytes(8), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM coupon_assignments WHERE qr_code = v_token);
  END LOOP;

  UPDATE coupon_assignments
  SET qr_code       = v_token,
      qr_expires_at = now() + interval '5 minutes'
  WHERE id = p_assignment_id;

  RETURN json_build_object(
    'success',    true,
    'qr_code',    v_token,
    'expires_at', (now() + interval '5 minutes'),
    'title',      v_coupon.title,
    'emoji',      v_coupon.emoji
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. RPC : validate_coupon (marque le coupon "used", SECURITY DEFINER) ──────

CREATE OR REPLACE FUNCTION validate_coupon(p_token text, p_admin_id uuid)
RETURNS json AS $$
DECLARE
  v_asgn   coupon_assignments%ROWTYPE;
  v_user   profiles%ROWTYPE;
  v_coupon coupons%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin') THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_asgn FROM coupon_assignments WHERE qr_code = p_token FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_asgn.status = 'used' THEN
    RETURN json_build_object('error', 'already_used');
  END IF;

  IF v_asgn.qr_expires_at IS NULL OR v_asgn.qr_expires_at < now() THEN
    RETURN json_build_object('error', 'qr_expired');
  END IF;

  SELECT * INTO v_coupon FROM coupons WHERE id = v_asgn.coupon_id;

  IF v_coupon.expires_at < now() THEN
    UPDATE coupon_assignments SET status = 'expired' WHERE id = v_asgn.id;
    RETURN json_build_object('error', 'expired');
  END IF;

  -- Marque comme utilisé — efface le QR pour éviter la réutilisation
  UPDATE coupon_assignments
  SET status       = 'used',
      validated_by = p_admin_id,
      used_at      = now(),
      qr_code      = NULL,
      qr_expires_at = NULL
  WHERE id = v_asgn.id;

  SELECT * INTO v_user FROM profiles WHERE id = v_asgn.user_id;

  RETURN json_build_object(
    'success',             true,
    'student_name',        v_user.full_name,
    'student_code',        v_user.student_code,
    'coupon_title',        v_coupon.title,
    'coupon_emoji',        v_coupon.emoji,
    'coupon_description',  v_coupon.description
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
