-- Migration v20 : table rewards — ajout colonnes level + points_required
-- et insertion des 8 paliers de fidélité

-- Ajout des nouvelles colonnes
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS level           integer;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS points_required integer;

-- Supprime toutes les récompenses existantes (remplacées par les 8 paliers officiels)
DELETE FROM rewards;

-- Réinitialise la séquence si présente
-- (pas nécessaire avec uuid pk)

-- Insère les 8 paliers officiels
INSERT INTO rewards (level, points_required, name, description, emoji, is_active) VALUES
(1, 20,  'Vestiaire gratuit',      'Lors d''une soirée BDE ECM Dijon',              '🧥',  true),
(2, 40,  '1 soft offert',          'Lors d''une soirée BDE ECM Dijon',              '🥤',  true),
(3, 70,  '1 bière offerte',        'Lors d''une soirée BDE ECM Dijon',              '🍺',  true),
(4, 100, 'Bracelet soirée gratuit','Lors d''une soirée BDE ECM Dijon',              '🎟️', true),
(5, 150, '1 pinte offerte',        'Lors d''une soirée BDE ECM Dijon',              '🍻',  true),
(6, 200, '1 conso offerte',        'Lors d''une soirée BDE ECM Dijon en boîte',     '🍸',  true),
(7, 300, 'Sweat BDE ECM Dijon',    'À récupérer au bureau BDE',                     '👕',  true),
(8, 500, '1 bouteille offerte',    'Lors d''une soirée BDE ECM Dijon en boîte',     '🍾',  true);
