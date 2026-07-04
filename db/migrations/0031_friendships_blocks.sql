-- Commentator Platform Epic, PRD-06 (FR-23): double opt-in friendships +
-- blocking. Friendship carries no messaging (DMs stay a non-goal).

-- --------------------------------------------------------------- friendships
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(user_id) on delete cascade,
  addressee_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- at most ONE active (pending or accepted) relationship per unordered pair, so
-- A and B can't both have live requests and there's one friendship row
create unique index friendships_active_pair_idx
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  )
  where status in ('pending', 'accepted');

-- one declined row per direction: a decline persists to block the SAME
-- requester from re-requesting; the declining side may still initiate later
create unique index friendships_declined_dir_idx
  on public.friendships (requester_id, addressee_id)
  where status = 'declined';

create index friendships_addressee_idx
  on public.friendships (addressee_id, status);
create index friendships_requester_idx
  on public.friendships (requester_id, status);

alter table public.friendships enable row level security;

-- participants can read their own friendships (the UI derives sanitized state
-- via a service-role helper so a decline reads as "requested" per FR-23.1).
-- Writes go through the API routes as always.
create policy "friendships readable by participants"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- --------------------------------------------------------------- user_blocks
create table public.user_blocks (
  blocker_id uuid not null references public.profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

-- only the BLOCKER can read their blocks; the block is invisible to the blocked
-- user (FR-23.4)
create policy "blocks readable by the blocker"
  on public.user_blocks for select
  using (auth.uid() = blocker_id);
