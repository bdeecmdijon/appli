-- ============================================================
-- BDE ECM Dijon — Schéma v8
-- Ajoute la colonne phone sur profiles
-- À coller dans Supabase → SQL Editor → New query → Run
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
