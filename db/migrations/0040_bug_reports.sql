-- Short-term in-app bug reporter (testing + pre-launch + early live use). A
-- little widget in the Match Day room posts here through a service-role route;
-- RLS is ON with NO public policies, so reports (which carry page/device
-- context) are readable only by the server route + the admin surface — never by
-- anon/authed clients directly. Mirrors the waitlist pattern (migration 0036).
-- Intended to be retired after the testing window; user_id/room_id are plain
-- uuids (no FKs) so a report is never lost to a foreign-key hiccup.

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- reporter (null for a logged-out guest); denormalized username for easy reads
  user_id uuid,
  username text,
  -- room it was reported from + its state at the time (best-effort context)
  room_id uuid,
  room_state text,
  -- what the reporter chose + wrote
  category text,
  description text not null check (char_length(description) between 1 and 4000),
  -- auto-captured client context (all optional)
  path text,
  viewport text,
  user_agent text,
  -- triage
  status text not null default 'open' check (status in ('open', 'closed')),
  admin_note text
);

create index bug_reports_status_created_idx
  on public.bug_reports (status, created_at desc);

alter table public.bug_reports enable row level security;
-- Intentionally no policies: only the service role (the /api/bugs writer and the
-- admin read/triage route) can touch this table.
