-- Front-end review item 7: pre-launch email capture ("get an email when the
-- first rooms open"). Turns the between-matches / no-room-yet dead-ends into a
-- real action and doubles as the launch list. A public POST /api/waitlist writes
-- via the service role (validated + rate-limited); RLS is ON with NO public
-- policies, so the address list is never readable by anon (no email harvesting)
-- and only the server route can read/write it.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  -- where the signup came from (home_empty / matches / ...), for later triage
  source text,
  created_at timestamptz not null default now(),
  -- set when we email this address at launch (dedupe future sends)
  notified_at timestamptz
);

alter table public.waitlist enable row level security;
-- Intentionally no policies: only the service role bypasses RLS, so anon can
-- neither read the list nor write it directly. The /api/waitlist route is the
-- sole writer.
