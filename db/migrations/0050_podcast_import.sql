-- Imported legacy episodes (founder 2026-09-07): the show existed on Spotify
-- hosting before the feed did, and keeping those episodes across the host
-- migration requires carrying their ORIGINAL guids (Spotify matches episodes
-- by guid when a show moves hosts). Old guids are not UUIDs, so guid becomes
-- text; imported rows have no room and use kind 'import'.
alter table public.podcast_episodes
  alter column guid type text using guid::text,
  alter column guid set default gen_random_uuid()::text;

alter table public.podcast_episodes
  drop constraint if exists podcast_episodes_kind_check;
alter table public.podcast_episodes
  add constraint podcast_episodes_kind_check
    check (kind in ('pregame', 'match', 'postgame', 'import'));
