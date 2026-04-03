-- Migration v19 : table push_subscriptions pour Web Push natif (iOS PWA + VAPID)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  device_type text,       -- 'ios', 'chrome', 'unknown'
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- RLS : chaque utilisateur ne voit que ses propres subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur voit ses subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur insère ses subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur supprime ses subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- L'API server (service_role) lit toutes les subscriptions pour l'envoi
-- → la service_role key bypass RLS automatiquement, pas besoin de policy supplémentaire
