-- Product telemetry for the admin insights dashboard: a lightweight append-only
-- event log powering funnel / retention / feature-usage analytics. Written by
-- the public /api/events route (service role, keepalive/sendBeacon); RLS is ON
-- with NO public policies, so events (which carry user_id / paths / props) are
-- readable only by the server + the admin insights loader — never anon/authed
-- clients. Mirrors the waitlist/bug_reports pattern; user_id/room_id are plain
-- uuids (no FKs) so a beacon is never lost to a foreign-key hiccup.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null check (char_length(event) between 1 and 60),
  -- reporter (null for a logged-out visitor); session_id groups anon activity
  user_id uuid,
  session_id text,
  room_id uuid,
  path text,
  props jsonb
);

create index events_event_created_idx on public.events (event, created_at desc);
create index events_created_idx on public.events (created_at desc);
create index events_user_idx
  on public.events (user_id, created_at desc)
  where user_id is not null;

alter table public.events enable row level security;
-- Intentionally no policies: only the service role (the /api/events writer + the
-- admin insights loader) reads/writes this table.
