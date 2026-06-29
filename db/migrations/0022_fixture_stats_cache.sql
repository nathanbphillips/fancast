-- Phase 11: daily-warmed snapshot of a fixture's match data (info / lineups /
-- stats / events), keyed by the rooms-facing fixture id. The daily match-check
-- cron fetches Sportmonks once per upcoming matched room and stores the
-- normalized FixtureStats here. The stats proxy serves it as a cold-start /
-- outage fallback so a room stays populated even when the live fetch can't run.
-- $0: rides the existing daily cron + flat Sportmonks plan; reads are public
-- (same data the open stats proxy already returns); writes are service-role.
create table if not exists public.fixture_stats_cache (
  fixture_id bigint primary key,
  snapshot jsonb not null,
  warmed_at timestamptz not null default now()
);

alter table public.fixture_stats_cache enable row level security;

drop policy if exists fixture_stats_cache_read on public.fixture_stats_cache;
create policy fixture_stats_cache_read on public.fixture_stats_cache for select using (true);
