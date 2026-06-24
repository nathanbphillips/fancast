-- Phase 9: listener_segments — durable audio-listening sessions for the founder
-- metrics (peak concurrent, total listen time, unique listeners, retention).
-- Written via /api/listen (service role). PRIVATE to the founder/admin: no
-- select policy, so only the service role / direct DB connection reads them.
-- A client holds only the unguessable segment id returned on start, which is
-- its capability to heartbeat/close that one segment. Open segments are closed
-- by an explicit stop, an unload beacon, or the stale sweep in the metrics job.
create table public.listener_segments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  -- null = anonymous listener (listening is open, FR-2.4)
  user_id uuid references public.profiles(user_id) on delete set null,
  mode text not null default 'live' check (mode in ('live', 'radio')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index listener_segments_room_idx on public.listener_segments (room_id, started_at);
create index listener_segments_open_idx
  on public.listener_segments (last_seen_at)
  where ended_at is null;

alter table public.listener_segments enable row level security;
-- no select/insert/update policy: metrics are founder/admin-only, written by the
-- service role through /api/listen and read by the metrics job (service role).
