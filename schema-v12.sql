-- ============================================================
-- BDE ECM Dijon — Schéma v12
-- Table game_plays : enregistre qui a joué à quelle soirée
-- Contrainte unique (user_id, game_id) → 1 partie par personne par soirée
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS game_plays (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id    text        NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
  played_at  timestamptz DEFAULT now(),
  prize_won  integer     DEFAULT 0
);

-- Un seul jeu par utilisateur par soirée
CREATE UNIQUE INDEX IF NOT EXISTS game_plays_user_game
  ON game_plays(user_id, game_id);

ALTER TABLE game_plays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_plays_select" ON game_plays;
CREATE POLICY "game_plays_select"
  ON game_plays FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "game_plays_insert" ON game_plays;
CREATE POLICY "game_plays_insert"
  ON game_plays FOR INSERT
  WITH CHECK (auth.uid() = user_id);
