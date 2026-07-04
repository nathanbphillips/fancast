-- Commentator Platform Epic, PRD-03 (FR-20): season hosting. One click gives a
-- commentator a scheduled room for every game a team plays in a competition
-- this season, now and as new fixtures appear.

-- ------------------------------------------------- host_team_subscriptions
create table public.host_team_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  team_id integer not null,
  league_id integer not null,
  season integer not null,
  team_name text not null,
  competition text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  -- one subscription per team+competition+season per commentator (FR-20.3)
  unique (user_id, team_id, league_id, season)
);

create index host_team_subscriptions_active_idx
  on public.host_team_subscriptions (active)
  where active;

alter table public.host_team_subscriptions enable row level security;

-- a commentator reads only their own subscriptions
create policy "own subscriptions readable"
  on public.host_team_subscriptions for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------ rooms.subscription_id
-- provenance: which subscription auto-created this room (FR-20.4 badge +
-- unsubscribe scope). Nullable: manually created rooms have none. ON DELETE
-- SET NULL so removing a subscription never cascades to delete rooms.
alter table public.rooms
  add column subscription_id uuid
    references public.host_team_subscriptions(id) on delete set null;

create index rooms_subscription_idx
  on public.rooms (subscription_id)
  where subscription_id is not null;
