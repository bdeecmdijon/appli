-- ============================================================
-- BDE ECM Dijon — Schéma v3 : table classements
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

CREATE TABLE classements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport       text NOT NULL,
  position    int  NOT NULL CHECK (position > 0),
  points      int,                        -- null si pas de système de points
  competition text NOT NULL,              -- "Championnat régional FFSU"
  is_featured boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON classements(is_featured);
CREATE INDEX ON classements(sport);

-- RLS
ALTER TABLE classements ENABLE ROW LEVEL SECURITY;

-- Lecture publique
CREATE POLICY "classements_select" ON classements
  FOR SELECT USING (true);

-- Écriture réservée aux admins
CREATE POLICY "classements_insert" ON classements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "classements_update" ON classements
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "classements_delete" ON classements
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Données de départ
INSERT INTO classements (sport, position, points, competition, is_featured) VALUES
  ('Football',   2, 28, 'Championnat régional FFSU',  true),
  ('Basketball', 4, 18, 'Ligue inter-écoles Est',     true),
  ('Volleyball', 1, 33, 'Coupe des grandes écoles',   true);
