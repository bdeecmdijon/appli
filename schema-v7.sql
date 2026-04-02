-- ============================================================
-- BDE ECM Dijon — Schéma v7
-- Corrections :
--   1. Ajoute les colonnes ecole / formation / autre_ecole sur profiles
--      (si schema-v4 n'a pas été appliqué)
--   2. Corrige la politique RLS events_select :
--      la v1 bloquait les events en status 'draft',
--      ce qui vidait la liste dans l'app
--   3. Politique RLS profiles_update explicite (sans USING doublonnée)
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

-- ── 1. Colonnes manquantes sur profiles ───────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ecole       text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS formation   text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS autre_ecole text;

-- ── 2. Politique events : accès public à tous les événements ──────────────
-- L'ancienne politique "events_select" exigeait status = 'published',
-- ce qui bloquait les événements créés par défaut (status = 'draft').
-- On autorise la lecture publique de tous les événements.

DROP POLICY IF EXISTS "events_select" ON events;

CREATE POLICY "events_select"
  ON events FOR SELECT
  USING (true);

-- ── 3. S'assurer que les politiques profiles existent bien ─────────────────
-- (safe : DROP IF EXISTS avant re-création)

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  USING (true);                             -- lecture publique de tous les profils

CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);            -- on ne peut créer que son propre profil

CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)                  -- on ne peut modifier que son propre profil
  WITH CHECK (auth.uid() = id);
