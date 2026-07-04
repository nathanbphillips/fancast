-- Commentator Platform Epic, PRD-07 (FR-24): fan score + profile history.
-- fan_score = max(0, comments + weighted_upvotes - weighted_downvotes), floored
-- at zero; components stored separately so badges/levels arrive without a
-- migration. Matches attended = rooms with 15+ cumulative minutes listened.

create table public.profile_stats (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  comments_count int not null default 0,
  upvotes_raw int not null default 0,
  upvotes_weighted numeric not null default 0,
  downvotes_raw int not null default 0,
  downvotes_weighted numeric not null default 0,
  fan_score int not null default 0,
  matches_attended int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.profile_stats enable row level security;

-- the score renders on public profiles
create policy "profile stats readable by everyone"
  on public.profile_stats for select
  using (true);

-- ------------------------------------------------------------------ backfill
-- one-time population from existing data; the nightly cron + incremental bumps
-- keep it current afterwards. Votes only count on NON-hidden messages (a hidden
-- message and its votes drop out of the score, FR-24.6).
insert into public.profile_stats (
  user_id, comments_count, upvotes_raw, upvotes_weighted,
  downvotes_raw, downvotes_weighted, fan_score, matches_attended, updated_at
)
select
  p.user_id,
  coalesce(c.comments, 0),
  coalesce(v.up_raw, 0),
  coalesce(v.up_w, 0),
  coalesce(v.down_raw, 0),
  coalesce(v.down_w, 0),
  greatest(
    0,
    coalesce(c.comments, 0) + coalesce(v.up_w, 0) - coalesce(v.down_w, 0)
  )::int,
  coalesce(a.attended, 0),
  now()
from public.profiles p
left join (
  select user_id, count(*) as comments
  from public.chat_messages
  where hidden_at is null
  group by user_id
) c on c.user_id = p.user_id
left join (
  select
    m.user_id,
    count(*) filter (where mv.value = 1) as up_raw,
    coalesce(sum(mv.weight) filter (where mv.value = 1), 0) as up_w,
    count(*) filter (where mv.value = -1) as down_raw,
    coalesce(sum(mv.weight) filter (where mv.value = -1), 0) as down_w
  from public.message_votes mv
  join public.chat_messages m
    on m.id = mv.message_id and m.hidden_at is null
  group by m.user_id
) v on v.user_id = p.user_id
left join (
  select user_id, count(*) as attended
  from (
    select user_id, room_id,
      sum(extract(epoch from (coalesce(ended_at, now()) - started_at))) as secs
    from public.listener_segments
    where user_id is not null
    group by user_id, room_id
  ) s
  where secs >= 900
  group by user_id
) a on a.user_id = p.user_id;
