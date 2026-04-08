-- ──────────────────────────────────────────────────────────────────────────
-- Migration : Lancer du Cochonnet — Système de jeux BDE avec crédits
-- À exécuter dans l'éditeur SQL Supabase
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Étend la table "games" existante (utilisée par la roue de la chance)
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS event_name  TEXT,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Étend la table "game_plays" existante
ALTER TABLE game_plays
  ADD COLUMN IF NOT EXISTS result     TEXT,
  ADD COLUMN IF NOT EXISTS prize_name TEXT,
  ADD COLUMN IF NOT EXISTS coupon_id  UUID REFERENCES coupons(id),
  ADD COLUMN IF NOT EXISTS played_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Crédits de jeu par étudiant
CREATE TABLE IF NOT EXISTS game_credits (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id    UUID        NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
  credits    INTEGER     NOT NULL DEFAULT 0 CHECK (credits >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, game_id)
);

-- 4. Configuration des lots par jeu
CREATE TABLE IF NOT EXISTS game_prizes (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  zone             TEXT    NOT NULL,
  probability      INTEGER NOT NULL CHECK (probability >= 0 AND probability <= 100),
  prize_name       TEXT    NOT NULL,
  emoji            TEXT    NOT NULL,
  color            TEXT    NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  generates_coupon BOOLEAN NOT NULL DEFAULT false
);

-- 5. Traçabilité côté coupons
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS source_game_play_id UUID;

-- ── Seed : Lancer du Cochonnet ──────────────────────────────────────────────

INSERT INTO games (id, name, description, event_name, is_active)
VALUES (
  'bde00001-0000-0000-0000-000000000001',
  'Lancer du Cochonnet',
  'Lance ta boule et vise le cochonnet pour gagner des lots !',
  'Pétanque BDE',
  true
)
ON CONFLICT DO NOTHING;

-- Lots (sum des probabilités = 100%)
INSERT INTO game_prizes (game_id, zone, probability, prize_name, emoji, color, sort_order, generates_coupon)
VALUES
  ('bde00001-0000-0000-0000-000000000001', 'perdu',   50, 'Raté ! Retente au prochain achat', '🔴', '#ef4444', 6, false),
  ('bde00001-0000-0000-0000-000000000001', 'petit',   25, '-1€ sur ta prochaine commande',     '🟠', '#f97316', 5, true),
  ('bde00001-0000-0000-0000-000000000001', 'bon',     10, '1 soda offert',                     '🔵', '#3b82f6', 4, true),
  ('bde00001-0000-0000-0000-000000000001', 'super',    5, '1 bière 25cl offerte',              '🟢', '#22c55e', 3, true),
  ('bde00001-0000-0000-0000-000000000001', 'gros',     8, '1 pinte offerte',                   '🟣', '#a855f7', 2, true),
  ('bde00001-0000-0000-0000-000000000001', 'jackpot',  2, 'Sandwich + boisson offerts',        '🟡', '#eab308', 1, true)
ON CONFLICT DO NOTHING;
