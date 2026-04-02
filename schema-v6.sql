-- ============================================================
-- BDE ECM Dijon — Schéma v6 : type sur events + sondages
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

-- Ajoute la colonne type sur events (si elle n'existe pas déjà)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'event_bde'
  CHECK (type IN ('soiree_bde', 'event_bde', 'match_bds', 'event_sportif'));

-- Table sondages (un sondage optionnel par événement)
CREATE TABLE IF NOT EXISTS sondages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question   text NOT NULL,
  options    jsonb NOT NULL,          -- ex: ["Oui", "Non", "Peut-être"]
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)                  -- un seul sondage par événement
);

-- Table votes
CREATE TABLE IF NOT EXISTS sondages_votes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sondage_id     uuid NOT NULL REFERENCES sondages(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_choisie text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sondage_id, user_id)       -- un seul vote par user par sondage
);

CREATE INDEX IF NOT EXISTS idx_sondages_votes_sondage ON sondages_votes(sondage_id);

-- RLS
ALTER TABLE sondages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sondages_votes ENABLE ROW LEVEL SECURITY;

-- Lecture publique des sondages
CREATE POLICY "sondages_select"
  ON sondages FOR SELECT USING (true);

-- Lecture publique des votes (pour afficher les %)
CREATE POLICY "sondages_votes_select"
  ON sondages_votes FOR SELECT USING (true);

-- Voter : uniquement si connecté
CREATE POLICY "sondages_votes_insert"
  ON sondages_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Création/modification/suppression sondage : admin seulement
CREATE POLICY "sondages_insert"
  ON sondages FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "sondages_update"
  ON sondages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "sondages_delete"
  ON sondages FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
