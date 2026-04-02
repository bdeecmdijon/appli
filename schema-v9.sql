-- ============================================================
-- BDE ECM Dijon — Schéma v9
-- 1. Colonne student_code (unique) sur profiles
-- 2. Trigger d'auto-génération à l'inscription
-- 3. Backfill des profils existants
-- 4. Table points_history
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── 1. Colonne student_code ───────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_code text UNIQUE;

-- ── 2. Fonction de génération de code unique ──────────────────────────────

CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text;
  done  bool := false;
BEGIN
  WHILE NOT done LOOP
    code := 'ECM-';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    done := NOT EXISTS (SELECT 1 FROM profiles WHERE student_code = code);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Trigger : assign_student_code avant INSERT ─────────────────────────

CREATE OR REPLACE FUNCTION assign_student_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.student_code IS NULL THEN
    NEW.student_code := generate_student_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_student_code ON profiles;
CREATE TRIGGER trg_assign_student_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION assign_student_code();

-- ── 4. Backfill des profils sans code ─────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE student_code IS NULL LOOP
    UPDATE profiles SET student_code = generate_student_code() WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 5. Table points_history ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS points_history (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount     integer     NOT NULL,
  reason     text,
  admin_id   uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "points_history_select" ON points_history;
CREATE POLICY "points_history_select"
  ON points_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "points_history_insert" ON points_history;
CREATE POLICY "points_history_insert"
  ON points_history FOR INSERT
  WITH CHECK (true);

-- ── 6. Étendre la politique profiles_update pour l'admin ──────────────────
-- Permet à tout utilisateur authentifié de mettre à jour n'importe quel
-- profil (nécessaire pour l'interface admin de points). À restreindre en prod
-- via une colonne `role` sur profiles ou un appel server-side.

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);
