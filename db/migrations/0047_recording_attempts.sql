-- Processing attempt counter (2026-09-01). A show longer than ~3h can be
-- killed by the platform's 300s function wall with no error written; the
-- downloads page and the daily cron now re-trigger a stale run automatically,
-- and this counter caps the loop so an impossible job ends in an honest
-- "failed" instead of retrying forever. A manual retry resets it to zero.
alter table public.recordings
  add column if not exists attempts int not null default 0;
