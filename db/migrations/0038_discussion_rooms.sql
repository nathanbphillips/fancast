-- Anytime (discussion) rooms: rooms that are NOT a football fixture.
-- A room gains an explicit `kind`, its own free-text `title`, a NULLABLE
-- fixture_id (match rooms keep theirs), and an OPTIONAL stats-only
-- `linked_fixture_id` (e.g. a discussion room "watching" another game — kept
-- separate from identity so the linked game's schedule never drives the room).
--
-- Backward-compatible: every existing room becomes kind='match' with its
-- current fixture; nothing else changes. The existing
-- unique(fixture_id, commentator_id) is left as-is — Postgres treats NULLs as
-- distinct, so it still enforces one room per match per host while allowing a
-- host many discussion rooms (all with fixture_id NULL).

alter table public.rooms
  add column if not exists kind text not null default 'match'
    check (kind in ('match', 'discussion'));

alter table public.rooms
  add column if not exists title text
    check (title is null or char_length(title) between 1 and 90);

-- discussion rooms have no fixture (match rooms still require one, enforced in code)
alter table public.rooms
  alter column fixture_id drop not null;

-- stats-only pointer, separate from room identity. SET NULL: if the linked
-- fixture is ever purged, the room simply loses its stats link.
alter table public.rooms
  add column if not exists linked_fixture_id bigint
    references public.fixtures(id) on delete set null;

-- a discussion room's title is what shows anywhere a matchup would; helps any
-- future title search/dedupe without scanning.
create index if not exists rooms_kind_idx on public.rooms (kind);
