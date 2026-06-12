-- Phase 5 (radio): HLS egress bookkeeping on rooms.
-- Phase 6 (clock): event-sourced match clock (golden rule 6 — the clock
-- is never ticked over the wire; clients derive display time locally).

alter table public.rooms
  add column hls_url text,
  add column hls_egress_id text;

create table public.clock_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  action text not null check (
    action in ('start1h', 'stop1h', 'start2h', 'stop2h', 'start_et', 'stop_et', 'adjust')
  ),
  server_ts timestamptz not null default now(),
  -- adjust: +/- seconds applied to the running clock; 0 otherwise
  offset_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create index clock_events_room_idx on public.clock_events (room_id, server_ts);

alter table public.clock_events enable row level security;

create policy "clock events readable by everyone"
  on public.clock_events for select
  using (true);
