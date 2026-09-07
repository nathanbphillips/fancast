-- Podcast hosting rolled back to Spotify (founder 2026-09-07): storage costs
-- grow forever on our side and RSS polling delays post-game releases, so the
-- feed, publish flow, and episode rows are retired. Episode notes and the
-- Full match blend stay; uploads happen in Spotify for Creators.
drop table if exists public.podcast_episodes;
