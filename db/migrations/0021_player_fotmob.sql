-- Phase 11: cache of Sportmonks player id -> Fotmob profile, resolved once in
-- the background when a lineup appears and reused forever (player ids are
-- stable). fotmob_url null = "resolved, but no confident match" (so we don't
-- re-hit Fotmob). Writes go through the service role; reads are public.
create table if not exists public.player_fotmob (
  sportmonks_player_id bigint primary key,
  name text not null,
  fotmob_id bigint,
  fotmob_url text,
  resolved_at timestamptz not null default now()
);

alter table public.player_fotmob enable row level security;

drop policy if exists player_fotmob_read on public.player_fotmob;
create policy player_fotmob_read on public.player_fotmob for select using (true);
