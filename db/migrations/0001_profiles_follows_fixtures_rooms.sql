-- Phase 2: identity, follows, fixtures, rooms.
-- Write model (CLAUDE.md golden rule 5): clients never write these tables
-- directly. All writes go through API routes using the service role (which
-- bypasses RLS) after zod validation. RLS therefore grants SELECT only;
-- the absence of insert/update/delete policies denies direct client writes.

create extension if not exists citext;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique
    check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  role text not null default 'listener'
    check (role in ('listener', 'commentator', 'admin')),
  avatar_url text,
  -- moderation standing; drives flag weighting in Phase 3 (FR-8.3)
  standing text not null default 'good'
    check (standing in ('good', 'restricted')),
  -- null = follow system preference
  theme_pref text check (theme_pref in ('dark', 'light')),
  -- null until the first rename; renames locked for 30 days after (FR-2.1)
  username_changed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles readable by everyone"
  on public.profiles for select
  using (true);

-- ---------------------------------------------------------------- follows
create table public.follows (
  follower_id uuid not null references public.profiles(user_id) on delete cascade,
  commentator_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, commentator_id),
  check (follower_id <> commentator_id)
);

create index follows_commentator_idx on public.follows (commentator_id);

alter table public.follows enable row level security;

create policy "follows readable by everyone"
  on public.follows for select
  using (true);

-- ---------------------------------------------------------------- fixtures
-- Local cache of API-Football fixtures (Arsenal only in MVP).
-- id is the API-Football fixture id; seed rows use negative ids so the
-- first real sync can never collide and can purge them (id < 0).
create table public.fixtures (
  id bigint primary key,
  league_id integer,
  season integer,
  competition text not null,
  round text,
  home_team text not null,
  away_team text not null,
  home_team_id integer,
  away_team_id integer,
  kickoff_utc timestamptz not null,
  -- API-Football short status code (NS, 1H, HT, 2H, FT, PST, ...)
  status text not null default 'NS',
  home_score integer,
  away_score integer,
  updated_at timestamptz not null default now()
);

create index fixtures_kickoff_idx on public.fixtures (kickoff_utc);

alter table public.fixtures enable row level security;

create policy "fixtures readable by everyone"
  on public.fixtures for select
  using (true);

-- ---------------------------------------------------------------- rooms
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  fixture_id bigint not null references public.fixtures(id),
  commentator_id uuid not null references public.profiles(user_id),
  state text not null default 'scheduled'
    check (state in ('scheduled', 'waiting', 'pregame', 'live_1h', 'halftime',
                     'live_2h', 'extra_time', 'postgame', 'wrapped')),
  scheduled_kickoff timestamptz not null,
  opened_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  livekit_room text,
  created_at timestamptz not null default now(),
  unique (fixture_id, commentator_id)
);

create index rooms_state_idx on public.rooms (state);

alter table public.rooms enable row level security;

create policy "rooms readable by everyone"
  on public.rooms for select
  using (true);
