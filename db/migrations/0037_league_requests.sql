-- Custom rooms (founder 2026-07-06): hosts creating a room for a match outside
-- our covered competitions can tell us which league/competition to add next,
-- straight from the create-room page. Free text on purpose: a dropdown of every
-- league across every sport would be overwhelming; requests are triaged by hand.
-- RLS is ON with NO policies, so only the service role reads/writes (the route
-- validates + rate-limits) and the request list is never publicly readable.

create table public.league_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  league text not null,
  created_at timestamptz not null default now()
);

create index league_requests_created_idx on public.league_requests (created_at desc);

alter table public.league_requests enable row level security;
