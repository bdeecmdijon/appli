-- v22 : Points de bienvenue (10 pts à l'inscription)
-- À exécuter dans Supabase > SQL Editor

-- Change le défaut de points_balance à 10
-- Tout nouveau profil créé (via trigger ou direct) démarre avec 10 pts
ALTER TABLE profiles
  ALTER COLUMN points_balance SET DEFAULT 10;

-- (Optionnel) Donne 10 pts aux comptes existants qui ont encore 0
UPDATE profiles
SET points_balance = 10
WHERE points_balance = 0;
