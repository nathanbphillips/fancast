-- Founder changes 2026-06-11:
-- 1) waiting-room countdown targets a commentator-set broadcast start
--    time rather than kickoff
-- 2) commentator can open chat and/or links to listeners during the
--    waiting room, before audio begins
alter table public.rooms
  add column broadcast_start timestamptz,
  add column chat_open boolean not null default false,
  add column links_open boolean not null default false;
