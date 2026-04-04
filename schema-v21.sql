-- v21 : Système de streak (soirées consécutives)
-- À exécuter dans Supabase > SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_event_date date;

-- Commentaires
COMMENT ON COLUMN profiles.current_streak    IS 'Nombre de soirées BDE consécutives auxquelles l''utilisateur a participé';
COMMENT ON COLUMN profiles.last_event_date   IS 'Date de la dernière soirée participée (pour calculer le streak)';
