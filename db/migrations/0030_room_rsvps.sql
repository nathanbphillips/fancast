-- Commentator Platform Epic, PRD-05 (FR-22): RSVPs and attendance counts.
-- "Attend" only ever attaches to the room, never the match (load-bearing copy
-- rule; strings live in lib/strings/attendance.ts).

-- --------------------------------------------------------------- room_rsvps
create table public.room_rsvps (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_rsvps_user_idx on public.room_rsvps (user_id);

alter table public.room_rsvps enable row level security;

-- A user can read their OWN rsvp rows (to know if they're counted in). The
-- aggregate count is denormalized onto rooms.rsvp_count (world-readable), and
-- friend chips resolve through a viewer-scoped API route joining friendships,
-- so raw rsvp rows are never world-readable (FR-22.6 privacy).
create policy "own rsvps readable"
  on public.room_rsvps for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------------ rooms.rsvp_count
-- denormalized aggregate, recomputed on every rsvp write (same pattern as the
-- chat vote aggregates)
alter table public.rooms
  add column rsvp_count int not null default 0;
