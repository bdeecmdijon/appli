-- ============================================================
-- BDE ECM Dijon — Schéma v13
-- 1. Colonne role sur profiles (user / admin)
-- 2. Table partners
-- 3. Colonne video_url sur events
-- 4. Table notifications_history
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── 1. Colonne role ───────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- Donner le rôle admin (remplace par ton email) :
-- UPDATE profiles SET role = 'admin' WHERE id IN (
--   SELECT id FROM auth.users WHERE email = 'ton@email.com'
-- );

-- ── 2. Table partners ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  address     text,
  city        text,
  phone       text,
  description text,
  offer       text,
  category    text,
  logo_url    text,
  is_active   boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_select" ON partners;
CREATE POLICY "partners_select"
  ON partners FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "partners_admin" ON partners;
CREATE POLICY "partners_admin"
  ON partners FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 3. Colonne video_url sur events ───────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS video_url text;

-- ── 4. Table notifications_history ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications_history (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title      text        NOT NULL,
  message    text        NOT NULL,
  event_id   uuid        REFERENCES events(id) ON DELETE SET NULL,
  sent_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at    timestamptz DEFAULT now(),
  recipients integer     DEFAULT 0
);

ALTER TABLE notifications_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifs_admin" ON notifications_history;
CREATE POLICY "notifs_admin"
  ON notifications_history FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
