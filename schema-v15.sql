-- schema-v15.sql
-- Correctifs profil : colonnes manquantes, student_code, RLS, points_balance
-- À exécuter dans Supabase → SQL Editor → New query → Run

-- ── 1. Colonnes profil (safety net si migrations v4/v7/v8 non jouées) ─────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone        text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ecole        text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS formation    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS autre_ecole  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_code text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points_balance integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_points  integer NOT NULL DEFAULT 0;

-- ── 2. Valeur par défaut points_balance = 0 (au cas où) ──────────────────────

ALTER TABLE profiles ALTER COLUMN points_balance SET DEFAULT 0;
ALTER TABLE profiles ALTER COLUMN points_balance SET NOT NULL;

-- ── 3. Trigger student_code : génération automatique à l'INSERT ───────────────

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

-- ── 4. Backfill : assigne un code aux profils existants sans code ─────────────

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE student_code IS NULL LOOP
    UPDATE profiles SET student_code = generate_student_code() WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 5. RLS : permettre à un utilisateur de lire et mettre à jour son propre profil

-- Lecture : tout le monde (pour l'admin notamment)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

-- Insert : seulement soi-même (le trigger handle_new_user utilise SECURITY DEFINER)
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Update : soi-même OU admin
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 6. Vérification : affiche les profils sans student_code après backfill ────

SELECT id, email, student_code FROM profiles WHERE student_code IS NULL;
