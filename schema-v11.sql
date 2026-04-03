-- ============================================================
-- BDE ECM Dijon — Schéma v11
-- Table games : soirées actives pour déverrouiller la roue
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS games (
  id          text        PRIMARY KEY,   -- ex: "soiree_2024_03_15"
  label       text        NOT NULL,      -- ex: "Soirée de rentrée"
  is_active   boolean     DEFAULT true,
  expires_at  timestamptz,               -- null = pas d'expiration
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "games_select" ON games;
CREATE POLICY "games_select"
  ON games FOR SELECT
  USING (true);

-- Exemple de soirée active (à adapter)
-- INSERT INTO games (id, label, is_active) VALUES ('soiree_bde_2025', 'Soirée BDE 2025', true);
