-- v23 : Lien d'inscription sur les événements
-- À exécuter dans Supabase > SQL Editor

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_url   text,
  ADD COLUMN IF NOT EXISTS registration_label text;

COMMENT ON COLUMN events.registration_url   IS 'Lien externe d''inscription ou de billetterie';
COMMENT ON COLUMN events.registration_label IS 'Texte du bouton (défaut : "S''inscrire")';
