-- guid is the cross-host episode identity (Spotify matches by it during a
-- migration); a transient failure in the import's existence check must not
-- be able to duplicate one (review 2026-09-07).
create unique index if not exists podcast_episodes_guid_key
  on public.podcast_episodes (guid);
