-- Phase 9: match-day widgets (FR-12). Same write model as slider_votes — API
-- routes + service role after zod validation. Individual responses stay private
-- (owner-only SELECT, like slider_votes); the public aggregate is computed
-- server-side and published on the control channel. No denormalized counters,
-- so aggregates are recomputed on read (no drift, no RPC needed).

-- ------------------------------------------------------------- predictions
-- FR-12.1 score predictor (pregame): one scoreline per listener, resolves at FT.
create table public.predictions (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  home_score smallint not null check (home_score between 0 and 20),
  away_score smallint not null check (away_score between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.predictions enable row level security;

-- own scoreline visible to the owner; the distribution is published server-side
create policy "predictions readable by owner"
  on public.predictions for select
  using (user_id = auth.uid());

-- ------------------------------------------------------------------- polls
-- FR-12.2 halftime poll: the commentator poses one templated question (2-4
-- options). The question + options + status are PUBLIC (everyone sees the poll);
-- individual votes are private.
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question text not null,
  options text[] not null check (array_length(options, 1) between 2 and 4),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index polls_room_idx on public.polls (room_id, created_at);

alter table public.polls enable row level security;

create policy "polls readable by everyone"
  on public.polls for select
  using (true);

create table public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  option_idx smallint not null check (option_idx between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.poll_votes enable row level security;

create policy "poll votes readable by owner"
  on public.poll_votes for select
  using (user_id = auth.uid());

-- ----------------------------------------------------------- player_ratings
-- FR-12.3 player ratings (postgame): rate starters + used subs 1-10. player_id
-- is the Sportmonks player id (matches lineups in the stats payload).
create table public.player_ratings (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  player_id bigint not null,
  rating smallint not null check (rating between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id, player_id)
);

alter table public.player_ratings enable row level security;

create policy "player ratings readable by owner"
  on public.player_ratings for select
  using (user_id = auth.uid());
