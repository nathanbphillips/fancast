-- Phase 5: on-air history (elevations, departures, removals).
-- Drives the "never previously removed from air" eligibility gate (FR-4.4)
-- and Phase 8's segment bookkeeping.
create table public.speaker_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  action text not null check (action in ('elevated', 'left_air', 'removed')),
  server_ts timestamptz not null default now()
);

create index speaker_events_room_idx on public.speaker_events (room_id, server_ts);
create index speaker_events_user_idx on public.speaker_events (user_id, action);

alter table public.speaker_events enable row level security;

create policy "speaker events readable by self, room commentator, admin"
  on public.speaker_events for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.commentator_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );
