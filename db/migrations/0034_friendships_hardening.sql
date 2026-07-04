-- PRD-06 hardening (adversarial review 2026-07-03).

-- (1) Silent-decline leak: the participant SELECT policy let a requester read
-- their own row's raw status='declined' via the browser anon client, defeating
-- the server-only sanitization. Friendship state is ALWAYS computed server-side
-- (lib/friends.ts, service role), so no client ever needs to read this table.
-- Drop the anon-readable policy: reads are service-role only now (like the
-- moderation tables). Writes already go through API routes.
drop policy if exists "friendships readable by participants" on public.friendships;

-- (2) Rate-limit bypass: the 20/day cap counted surviving friendships rows,
-- which withdraw/unfriend/block delete, so request->withdraw looped forever.
-- An append-only event log makes the count un-bypassable (never deleted).
create table public.friend_request_events (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create index friend_request_events_rate_idx
  on public.friend_request_events (requester_id, created_at);

alter table public.friend_request_events enable row level security;
-- service-role only; never client-read
