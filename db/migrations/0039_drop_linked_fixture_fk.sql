-- Fix (regression from 0038): the linked_fixture_id FK added a SECOND
-- rooms->fixtures relationship, which made every existing `fixture:fixtures(...)`
-- PostgREST embed AMBIGUOUS (PGRST201 "more than one relationship") and 500'd
-- the home/matches/room/profile pages.
--
-- linked_fixture_id is a STATS-ONLY pointer read by id via the stats API — it is
-- never PostgREST-embedded — so it does not need a foreign key. Dropping the
-- constraint restores a single, unambiguous rooms->fixtures relationship.
-- linked_fixture_id stays as a plain bigint; the linking code already validates
-- the fixture exists, and a stale id degrades gracefully to "coming soon".

alter table public.rooms
  drop constraint if exists rooms_linked_fixture_id_fkey;
