-- Admin-created rooms (World Cup / friendlies / any game). A fixture can now
-- exist before it is matched to a Sportmonks fixture:
--   sportmonks_fixture_id  the real Sportmonks fixture id used for the stats/info
--                          upstream calls. NULL until the daily matcher finds it
--                          (or permanently NULL for competitions the plan does
--                          not cover — those rooms just show "Information coming
--                          soon"). Existing rows are synced, so their PK id IS
--                          the Sportmonks id — backfill it.
--   source                 'sportmonks' (synced) | 'admin' (hand-created)
-- The PK stays the room's fixture_id; admin fixtures use a synthetic id (epoch
-- ms, far above any real Sportmonks id) so they never collide with a sync.
alter table public.fixtures
  add column sportmonks_fixture_id bigint,
  add column source text not null default 'sportmonks';

update public.fixtures set sportmonks_fixture_id = id where sportmonks_fixture_id is null;

-- the matcher scans for admin fixtures still awaiting a Sportmonks match
create index fixtures_pending_match_idx on public.fixtures (kickoff_utc)
  where source = 'admin' and sportmonks_fixture_id is null;
