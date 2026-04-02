-- ============================================================
-- BDE ECM Dijon — Schéma Supabase complet
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type user_role as enum ('student', 'bde_member', 'admin');
create type event_status as enum ('draft', 'published', 'cancelled', 'past');
create type match_status as enum ('pending', 'accepted', 'declined', 'expired');
create type partner_category as enum ('restaurant', 'bar', 'sport', 'culture', 'shopping', 'other');
create type transaction_type as enum ('earn', 'spend', 'bonus', 'refund');
create type notification_type as enum ('event', 'match', 'points', 'system');
create type game_type as enum ('quiz', 'wheel', 'scratch');

-- ============================================================
-- PROFILES
-- ============================================================

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  email         text unique not null,
  full_name     text,
  avatar_url    text,
  promo         text,                        -- ex: "2026", "Master 1"
  program       text,                        -- ex: "Bachelor", "Master Commerce"
  role          user_role not null default 'student',

  points_balance integer not null default 0,
  total_points   integer not null default 0, -- cumulatif (pour tiers)

  bio           text,
  instagram     text,
  linkedin      text,

  is_visible_matching boolean not null default true,
  push_token    text                         -- Expo / Web Push token
);

-- Trigger : met à jour updated_at automatiquement
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at();

-- ============================================================
-- LOYALTY TIERS
-- ============================================================

create table loyalty_tiers (
  id          serial primary key,
  name        text not null,               -- "Bronze", "Silver", "Gold", "Platinum"
  min_points  integer not null,
  max_points  integer,                     -- null = pas de plafond
  color       text not null,               -- hex color
  icon        text not null,               -- emoji ou nom d'icône
  benefits    text[] not null default '{}' -- liste d'avantages
);

insert into loyalty_tiers (name, min_points, max_points, color, icon, benefits) values
  ('Bronze',   0,    499,  '#CD7F32', '🥉', array['Accès aux events standard', 'Newsletter BDE']),
  ('Silver',   500,  1499, '#C0C0C0', '🥈', array['Accès prioritaire events', 'Réductions partenaires 5%', 'Badge profil']),
  ('Gold',     1500, 2999, '#FFD700', '🥇', array['Accès VIP events', 'Réductions partenaires 10%', 'Goodies BDE', 'Invitations exclusives']),
  ('Platinum', 3000, null, '#E8622A', '💎', array['Accès illimité', 'Réductions partenaires 15%', 'Meet & greet intervenants', 'Nom sur le mur de la promo']);

-- ============================================================
-- POINT TRANSACTIONS
-- ============================================================

create table point_transactions (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),

  user_id       uuid not null references profiles(id) on delete cascade,
  amount        integer not null,           -- positif = gain, négatif = dépense
  type          transaction_type not null,
  description   text not null,
  reference_id  uuid,                       -- id de l'event, game_session, etc.
  reference_type text                       -- 'event', 'game', 'partner', etc.
);

create index on point_transactions(user_id);
create index on point_transactions(created_at desc);

-- Trigger : met à jour points_balance et total_points dans profiles
create or replace function sync_points_balance()
returns trigger language plpgsql as $$
begin
  update profiles
  set
    points_balance = points_balance + new.amount,
    total_points   = total_points + greatest(new.amount, 0)
  where id = new.user_id;
  return new;
end;
$$;

create trigger after_point_transaction
  after insert on point_transactions
  for each row execute procedure sync_points_balance();

-- ============================================================
-- EVENTS
-- ============================================================

create table events (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  title         text not null,
  description   text,
  cover_url     text,
  location      text,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  status        event_status not null default 'draft',

  capacity      integer,                    -- null = illimité
  price_cents   integer not null default 0, -- en centimes
  points_reward integer not null default 50,

  created_by    uuid references profiles(id) on delete set null,
  tags          text[] not null default '{}'
);

create trigger events_updated_at
  before update on events
  for each row execute procedure update_updated_at();

create index on events(starts_at);
create index on events(status);

-- Inscriptions aux events
create table event_registrations (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),

  event_id      uuid not null references events(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  checked_in    boolean not null default false,
  checked_in_at timestamptz,

  unique(event_id, user_id)
);

create index on event_registrations(event_id);
create index on event_registrations(user_id);

-- ============================================================
-- MATCHES (speed-dating / networking étudiant)
-- ============================================================

create table matches (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  user_a        uuid not null references profiles(id) on delete cascade,
  user_b        uuid not null references profiles(id) on delete cascade,
  status        match_status not null default 'pending',

  message       text,                       -- message d'intro optionnel
  expires_at    timestamptz default (now() + interval '7 days'),

  constraint no_self_match check (user_a <> user_b)
);

create unique index unique_pair on matches (
  least(user_a::text, user_b::text),
  greatest(user_a::text, user_b::text)
);

create trigger matches_updated_at
  before update on matches
  for each row execute procedure update_updated_at();

create index on matches(user_a);
create index on matches(user_b);
create index on matches(status);

-- ============================================================
-- PARTNERS
-- ============================================================

create table partners (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),

  name          text not null,
  description   text,
  logo_url      text,
  cover_url     text,
  category      partner_category not null default 'other',
  address       text,
  website       text,
  phone         text,

  discount_label text,                      -- ex: "10% sur l'addition"
  discount_code  text,                      -- code promo éventuel
  points_required integer not null default 0,

  is_active     boolean not null default true
);

create index on partners(category);
create index on partners(is_active);

-- ============================================================
-- GAMES
-- ============================================================

create table games (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),

  type          game_type not null,
  title         text not null,
  description   text,
  config        jsonb not null default '{}', -- config spécifique selon le type
  points_reward integer not null default 20,
  cooldown_hours integer not null default 24, -- délai entre deux parties
  is_active     boolean not null default true
);

create table game_sessions (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),

  game_id       uuid not null references games(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,

  score         integer,
  result        jsonb,                      -- données du résultat (réponses, gain roue, etc.)
  points_earned integer not null default 0,
  completed     boolean not null default false
);

create index on game_sessions(user_id);
create index on game_sessions(game_id);
create index on game_sessions(created_at desc);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table notifications (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),

  user_id       uuid not null references profiles(id) on delete cascade,
  type          notification_type not null,
  title         text not null,
  body          text,
  data          jsonb,                      -- payload additionnel
  read          boolean not null default false,
  read_at       timestamptz
);

create index on notifications(user_id);
create index on notifications(read);
create index on notifications(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table profiles             enable row level security;
alter table point_transactions   enable row level security;
alter table events               enable row level security;
alter table event_registrations  enable row level security;
alter table matches              enable row level security;
alter table partners             enable row level security;
alter table games                enable row level security;
alter table game_sessions        enable row level security;
alter table notifications        enable row level security;

-- Profiles : lecture publique, écriture sur son propre profil
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Point transactions : lecture de ses propres transactions
create policy "transactions_select" on point_transactions for select using (auth.uid() = user_id);
create policy "transactions_insert" on point_transactions for insert with check (auth.uid() = user_id);

-- Events : lecture publique des events publiés
create policy "events_select" on events for select using (status = 'published' or auth.uid() = created_by);
create policy "events_insert" on events for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('bde_member', 'admin'))
);
create policy "events_update" on events for update using (
  auth.uid() = created_by or
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Event registrations
create policy "registrations_select" on event_registrations for select using (auth.uid() = user_id);
create policy "registrations_insert" on event_registrations for insert with check (auth.uid() = user_id);
create policy "registrations_delete" on event_registrations for delete using (auth.uid() = user_id);

-- Matches : lecture de ses propres matches
create policy "matches_select" on matches for select using (auth.uid() = user_a or auth.uid() = user_b);
create policy "matches_insert" on matches for insert with check (auth.uid() = user_a);
create policy "matches_update" on matches for update using (auth.uid() = user_a or auth.uid() = user_b);

-- Partners : lecture publique
create policy "partners_select" on partners for select using (is_active = true);

-- Games : lecture publique
create policy "games_select" on games for select using (is_active = true);

-- Game sessions : ses propres sessions
create policy "game_sessions_select" on game_sessions for select using (auth.uid() = user_id);
create policy "game_sessions_insert" on game_sessions for insert with check (auth.uid() = user_id);

-- Notifications : ses propres notifs
create policy "notifications_select" on notifications for select using (auth.uid() = user_id);
create policy "notifications_update" on notifications for update using (auth.uid() = user_id);

-- ============================================================
-- FONCTION : créer un profil après inscription
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- DONNÉES DE TEST
-- ============================================================

insert into games (type, title, description, config, points_reward, cooldown_hours) values
  ('quiz',    'Quiz Culture Générale', 'Teste tes connaissances !',
   '{"questions": [], "duration_seconds": 30}', 30, 24),
  ('wheel',   'Roue de la Fortune BDE', 'Tente ta chance !',
   '{"segments": [{"label": "20 pts", "points": 20}, {"label": "50 pts", "points": 50}, {"label": "100 pts", "points": 100}, {"label": "0 pt", "points": 0}]}', 0, 24),
  ('scratch', 'Grattage Lucky', 'Gratte et gagne des points',
   '{"win_probability": 0.4, "max_points": 100}', 0, 48);
