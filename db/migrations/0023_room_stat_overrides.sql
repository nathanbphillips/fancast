-- Phase 11: commentator overrides for the Info + Line-ups panels. One JSON blob
-- per room (venue/referee/weather/team-news corrections + lineup fixes), merged
-- onto the Sportmonks data client-side. DB is the source of truth; the control
-- channel carries live updates. Reads are public (same visibility as the stats
-- the room already shows); writes are commentator-only, enforced in the API and
-- performed with the service role.
create table if not exists public.room_stat_overrides (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid -- audit only (the auth user id); no FK to keep this forward-only safe
);

alter table public.room_stat_overrides enable row level security;

drop policy if exists room_stat_overrides_read on public.room_stat_overrides;
create policy room_stat_overrides_read on public.room_stat_overrides for select using (true);
