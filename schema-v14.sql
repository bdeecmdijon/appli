-- schema-v14.sql
-- Matchs BDS + colonne nuls pour classements

-- ── Table matchs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matchs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sport       text NOT NULL,
  competition text,
  adversaire  text NOT NULL,
  date_heure  timestamptz NOT NULL,
  lieu        text,
  score_ecm   integer,
  score_adv   integer,
  resultat    text NOT NULL DEFAULT 'a_venir'
              CHECK (resultat IN ('a_venir', 'victoire', 'defaite', 'nul')),
  commentaire text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE matchs ENABLE ROW LEVEL SECURITY;

-- Lecture publique (tous les utilisateurs connectés)
CREATE POLICY "matchs_select" ON matchs
  FOR SELECT USING (true);

-- Écriture réservée aux admins
CREATE POLICY "matchs_admin" ON matchs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Colonne nuls dans classements_equipes ─────────────────────────────────────

ALTER TABLE classements_equipes
  ADD COLUMN IF NOT EXISTS nuls integer NOT NULL DEFAULT 0;
