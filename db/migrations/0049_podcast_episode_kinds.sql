-- Three publishable shows per room (founder 2026-09-06): pre-game, the full
-- match blend, and post-game each become their own episode. One row per
-- (room, kind); republishing still keeps guid + published_at. published_at
-- doubles as the SCHEDULE: the feed only serves rows whose published_at has
-- passed, so a future date is a scheduled release with no cron needed.
alter table public.podcast_episodes
  add column if not exists kind text not null default 'postgame'
    check (kind in ('pregame', 'match', 'postgame'));

alter table public.podcast_episodes
  drop constraint if exists podcast_episodes_room_id_key;

alter table public.podcast_episodes
  add constraint podcast_episodes_room_kind_key unique (room_id, kind);
