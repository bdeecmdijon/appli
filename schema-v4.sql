-- ============================================================
-- BDE ECM Dijon — Schéma v4 : colonnes ecole, formation, autre_ecole
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ecole       text,         -- 'ECM' ou 'Autre école'
  ADD COLUMN IF NOT EXISTS formation   text,         -- formation ECM (nullable)
  ADD COLUMN IF NOT EXISTS autre_ecole text;         -- nom libre si pas ECM (nullable)

-- Migre les données existantes (program → formation)
UPDATE profiles
  SET formation = program
  WHERE formation IS NULL AND program IS NOT NULL;

-- Note : la colonne "program" est conservée pour compatibilité.
-- Supprimable plus tard avec : ALTER TABLE profiles DROP COLUMN program;
