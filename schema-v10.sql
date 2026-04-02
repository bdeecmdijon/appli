-- ============================================================
-- BDE ECM Dijon — Schéma v10
-- 1. Colonne type sur events
-- 2. Colonnes wins / losses sur classements_equipes
-- 3. Note : créer le bucket Supabase Storage "event-covers"
--    → Supabase Dashboard > Storage > New bucket
--    > Name: "event-covers", Public: ON
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── 1. Events : colonne type ──────────────────────────────────────────────

ALTER TABLE events ADD COLUMN IF NOT EXISTS type text DEFAULT 'event_bde';

-- ── 2. Classements équipes : victoires / défaites ─────────────────────────

ALTER TABLE classements_equipes ADD COLUMN IF NOT EXISTS wins    integer DEFAULT 0;
ALTER TABLE classements_equipes ADD COLUMN IF NOT EXISTS losses  integer DEFAULT 0;

-- ── 3. S'assurer que sondages a bien la colonne options (text[]) ──────────

ALTER TABLE sondages ADD COLUMN IF NOT EXISTS options text[] DEFAULT '{}';
