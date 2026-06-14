-- Phase 8: recording, segment markers, cut segments.
-- Recording is the room mix (commentator + guests as heard live, FR-13.4),
-- captured Start->End Broadcast, disconnect-proof (egress records the room
-- server-side). Private to commentator + admin (FR-14.2); downloads via
-- signed URLs. Same write model as elsewhere: API routes + service role.

-- ------------------------------------------------------ broadcast_markers
-- Segment boundaries. Clock transitions emit these automatically (FR-13.3);
-- Start/End Broadcast open/close the outermost span; the commentator's
-- Segment button adds manual marks. `kind` identifies the boundary;
-- `label` is the human name of the segment that BEGINS at this marker.
create table public.broadcast_markers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  kind text not null check (kind in (
    'broadcast_start', 'start_1h', 'stop_1h', 'start_2h', 'stop_2h',
    'start_et', 'stop_et', 'broadcast_end', 'manual'
  )),
  label text not null,
  source text not null default 'auto' check (source in ('auto', 'manual')),
  server_ts timestamptz not null default now(),
  -- commentator's post-session +/-2min nudge before cutting (FR-13.3)
  adjusted_ts timestamptz,
  created_at timestamptz not null default now()
);

create index broadcast_markers_room_idx
  on public.broadcast_markers (room_id, server_ts);

alter table public.broadcast_markers enable row level security;

create policy "markers readable by room commentator and admin"
  on public.broadcast_markers for select
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.commentator_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- ------------------------------------------------------------- recordings
create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade unique,
  egress_id text,
  -- raw room-composite file from LiveKit egress (whatever format it emits)
  source_path text,
  -- transcoded full-broadcast MP3 (the headline download)
  full_mp3_path text,
  zip_path text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds numeric,
  status text not null default 'recording'
    check (status in ('recording', 'processing', 'ready', 'failed', 'empty')),
  error text,
  -- retention: 90 days unless pinned (FR-14.3)
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.recordings enable row level security;

create policy "recordings readable by room commentator and admin"
  on public.recordings for select
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.commentator_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- ----------------------------------------------------- recording_segments
create table public.recording_segments (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  idx integer not null,
  label text not null,
  start_offset numeric not null,
  end_offset numeric not null,
  storage_path text,
  size_bytes bigint,
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  unique (recording_id, idx)
);

alter table public.recording_segments enable row level security;

create policy "recording segments readable by room commentator and admin"
  on public.recording_segments for select
  using (
    exists (
      select 1
      from public.recordings rec
      join public.rooms r on r.id = rec.room_id
      where rec.id = recording_id and r.commentator_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );
