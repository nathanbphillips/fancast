-- Podcast episodes (founder 2026-09-01): the published post-game shows that
-- make up the RSS feed Spotify (and any other directory) ingests. One episode
-- per room; republishing after a recut replaces the audio but keeps the guid
-- and publish date so directories treat it as the same episode. The audio
-- lives in the PUBLIC `podcast` storage bucket (episodes must stay up, so the
-- 60-day recordings retention never touches it); rows are permanent.
create table public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  -- the room the episode came from; the episode outlives the room
  room_id uuid unique references public.rooms(id) on delete set null,
  title text not null,
  description text not null,
  -- path inside the public `podcast` bucket
  audio_path text not null,
  audio_bytes bigint not null,
  duration_seconds numeric not null,
  -- RSS guid: stable across republishes
  guid uuid not null default gen_random_uuid(),
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.podcast_episodes enable row level security;
-- no anon policies: the feed route reads with the service role and serves XML
