-- Programme room rebuild (founder 2026-09-15): ASK THE GANTRY goes public.
-- Questions become a room-visible, upvoted list with an "answered on air"
-- badge, and hosts gain a pushed team-news bulletin that must survive
-- reconnects (DB is truth, Ably is transport).
--
-- (a) questions grow denormalized vote aggregates (raw up_count for display,
--     weighted score for ranking - the 0019 pattern) plus answered_at, stamped
--     when the host acknowledges; 'acknowledged' IS the answered-on-air state.
-- (b) question_votes are upvote-only (the mock has one arrow) with the same
--     established-account weighting as chat/link votes; the route sets weight
--     and self-votes carry 0, keeping the anti-gaming intent.
-- (c) A new permissive select policy makes non-dismissed questions readable
--     by everyone in the room, anon included (reading is always free);
--     dismissed rows stay visible only under the old author/host/admin policy.
-- (d) room_bulletins: host-pushed team-news lines, world-readable; the latest
--     row is the card everyone's stats rail shows, recovered via the snapshot.

alter table public.questions
  add column up_count int not null default 0,
  add column score numeric not null default 0,
  add column answered_at timestamptz;

create table public.question_votes (
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  value smallint not null check (value = 1),
  weight numeric not null default 1,
  created_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

alter table public.question_votes enable row level security;

create policy "own question votes readable"
  on public.question_votes for select
  using (auth.uid() = user_id);

-- public read of live questions; dismissed rows fall back to the original
-- author/commentator/admin policy from 0004 (policies OR together)
create policy "questions readable by everyone unless dismissed"
  on public.questions for select
  using (status <> 'dismissed');

-- upvote-only cast: p_value 1 sets/updates the vote, 0 removes it; recomputes
-- the denormalized aggregates under a parent-row lock (the 0019 shape)
create or replace function public.cast_question_vote(
  p_question_id uuid, p_user_id uuid, p_value smallint, p_weight numeric)
returns table(up int, score numeric)
language plpgsql security definer set search_path = public as $$
declare v_up int; v_score numeric;
begin
  perform 1 from questions where id = p_question_id for update;
  if p_value = 0 then
    delete from question_votes where question_id = p_question_id and user_id = p_user_id;
  else
    insert into question_votes(question_id, user_id, value, weight)
      values (p_question_id, p_user_id, 1, p_weight)
      on conflict (question_id, user_id)
        do update set weight = excluded.weight;
  end if;
  select count(*), coalesce(sum(value * weight), 0)
    into v_up, v_score from question_votes where question_id = p_question_id;
  update questions set up_count = v_up, score = v_score where id = p_question_id;
  up := v_up; score := v_score; return next;
end $$;

revoke execute on function public.cast_question_vote(uuid, uuid, smallint, numeric) from public, anon, authenticated;
grant execute on function public.cast_question_vote(uuid, uuid, smallint, numeric) to service_role;

-- ------------------------------------------------------------ room_bulletins
create table public.room_bulletins (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index room_bulletins_room_idx on public.room_bulletins (room_id, created_at desc);

alter table public.room_bulletins enable row level security;

create policy "bulletins readable by everyone"
  on public.room_bulletins for select
  using (true);
