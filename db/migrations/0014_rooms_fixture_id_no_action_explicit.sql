-- M-9 (audit): make rooms.fixture_id FK behavior explicit and intentional.
-- It already defaults to ON DELETE NO ACTION; this re-declares it under the
-- same name so the intent is documented in the schema: a room is a broadcast
-- artifact and must NEVER be silently destroyed because its fixture row was
-- purged (so deliberately NOT cascade). The seed-purge path (lib/fixtures.ts)
-- remaps any room referencing a negative-id seed to its real fixture before
-- deleting seeds. No data change. Constraint name verified as
-- rooms_fixture_id_fkey (Postgres <table>_<column>_fkey convention, 0001).
alter table public.rooms drop constraint rooms_fixture_id_fkey;
alter table public.rooms
  add constraint rooms_fixture_id_fkey
  foreign key (fixture_id) references public.fixtures(id) on delete no action;
