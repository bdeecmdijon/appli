-- ============================================================
-- BDE ECM Dijon — Schéma v2 : rewards, redemptions, coupons
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── Récompenses disponibles (configurées par l'admin) ──────────────────────

CREATE TABLE rewards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,           -- "Boisson offerte"
  description  text,
  points_cost  int  NOT NULL,
  emoji        text,                    -- "🍺"
  stock        int,                     -- null = illimité
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- Données de départ
INSERT INTO rewards (name, description, points_cost, emoji, stock) VALUES
  ('Boisson offerte', 'À retirer au bar partenaire sur présentation du QR code', 200, '🍺', null),
  ('Goodies BDE',     'Sweat ou tote bag ECM Dijon au choix',                    300, '🎁', 50),
  ('Entrée soirée',   'Accès à une soirée thématique BDE de ton choix',          500, '🎟️', null);

-- RLS
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_select" ON rewards FOR SELECT USING (is_active = true);


-- ── Échanges de points ────────────────────────────────────────────────────

CREATE TABLE redemptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reward_id       uuid REFERENCES rewards(id)  ON DELETE SET NULL,
  points_spent    int  NOT NULL,
  qr_code         text UNIQUE NOT NULL,         -- token unique généré
  qr_expires_at   timestamptz NOT NULL,         -- now() + 5 min
  status          text DEFAULT 'pending'        -- pending | used | expired
                  CHECK (status IN ('pending', 'used', 'expired')),
  validated_by    uuid,                         -- admin qui a validé
  validated_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON redemptions(user_id);
CREATE INDEX ON redemptions(status);
CREATE INDEX ON redemptions(qr_code);

-- RLS
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redemptions_select" ON redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "redemptions_insert" ON redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ── Coupons (attribués par l'admin pour soirées privées) ──────────────────

CREATE TABLE coupons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_id      uuid REFERENCES events(id)   ON DELETE SET NULL,
  title         text NOT NULL,                 -- "Shot offert"
  description   text,
  emoji         text,                          -- "🥃"
  status        text DEFAULT 'available'       -- available | used
                CHECK (status IN ('available', 'used')),
  used_at       timestamptz,
  validated_by  uuid,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX ON coupons(user_id);
CREATE INDEX ON coupons(status);

-- RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_select" ON coupons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "coupons_update" ON coupons FOR UPDATE USING (auth.uid() = user_id);
