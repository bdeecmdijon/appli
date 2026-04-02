-- ============================================================
-- BDE ECM Dijon — Schéma v5 : classements + classements_equipes
-- Remplace l'ancienne table "classements" (v3)
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

-- Supprime l'ancienne table si elle existait (v3)
DROP TABLE IF EXISTS classements CASCADE;

-- Classements (un par compétition/sport)
CREATE TABLE classements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport       text NOT NULL,
  competition text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Équipes d'un classement
CREATE TABLE classements_equipes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classement_id  uuid NOT NULL REFERENCES classements(id) ON DELETE CASCADE,
  position       int  NOT NULL CHECK (position > 0),
  nom_equipe     text NOT NULL,
  points         int,
  is_ecm         boolean NOT NULL DEFAULT false
);

CREATE INDEX ON classements_equipes(classement_id);
CREATE INDEX ON classements_equipes(position);

-- RLS
ALTER TABLE classements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE classements_equipes ENABLE ROW LEVEL SECURITY;

-- Lecture publique
CREATE POLICY "classements_select"         ON classements         FOR SELECT USING (true);
CREATE POLICY "classements_equipes_select" ON classements_equipes FOR SELECT USING (true);

-- Écriture admin uniquement
CREATE POLICY "classements_insert" ON classements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "classements_update" ON classements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "classements_delete" ON classements FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "classements_equipes_insert" ON classements_equipes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "classements_equipes_update" ON classements_equipes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "classements_equipes_delete" ON classements_equipes FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Données de départ
INSERT INTO classements (id, sport, competition) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Football',   'Championnat Régional Bourgogne FFSU'),
  ('11111111-0000-0000-0000-000000000002', 'Basketball',  'Ligue Inter-Écoles Est');

INSERT INTO classements_equipes (classement_id, position, nom_equipe, points, is_ecm) VALUES
  ('11111111-0000-0000-0000-000000000001', 1, 'ESC Clermont',   34, false),
  ('11111111-0000-0000-0000-000000000001', 2, 'ECM Dijon',      28, true),
  ('11111111-0000-0000-0000-000000000001', 3, 'ICN Nancy',      21, false),
  ('11111111-0000-0000-0000-000000000001', 4, 'EM Strasbourg',  17, false),
  ('11111111-0000-0000-0000-000000000002', 1, 'IESEG Lille',    30, false),
  ('11111111-0000-0000-0000-000000000002', 2, 'EM Lyon',        26, false),
  ('11111111-0000-0000-0000-000000000002', 3, 'ESSCA Angers',   22, false),
  ('11111111-0000-0000-0000-000000000002', 4, 'ECM Dijon',      18, true);
