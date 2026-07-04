-- PRD-07 (FR-24.5): recompute functions for fan score. Called by the nightly
-- cron (all users) and incrementally after message/vote events (one user). The
-- score is NEVER computed on page load; these keep profile_stats current.

-- recompute one user's stats (idempotent upsert). Mirrors the 0032 backfill.
create or replace function public.recompute_profile_stats(uid uuid)
returns void
language sql
as $$
  insert into public.profile_stats (
    user_id, comments_count, upvotes_raw, upvotes_weighted,
    downvotes_raw, downvotes_weighted, fan_score, matches_attended, updated_at
  )
  select
    uid,
    coalesce(c.comments, 0),
    coalesce(v.up_raw, 0),
    coalesce(v.up_w, 0),
    coalesce(v.down_raw, 0),
    coalesce(v.down_w, 0),
    greatest(0, coalesce(c.comments, 0) + coalesce(v.up_w, 0) - coalesce(v.down_w, 0))::int,
    coalesce(a.attended, 0),
    now()
  from (select 1) x
  left join (
    select count(*) as comments
    from public.chat_messages
    where user_id = uid and hidden_at is null
  ) c on true
  left join (
    select
      count(*) filter (where mv.value = 1) as up_raw,
      coalesce(sum(mv.weight) filter (where mv.value = 1), 0) as up_w,
      count(*) filter (where mv.value = -1) as down_raw,
      coalesce(sum(mv.weight) filter (where mv.value = -1), 0) as down_w
    from public.message_votes mv
    join public.chat_messages m
      on m.id = mv.message_id and m.hidden_at is null and m.user_id = uid
  ) v on true
  left join (
    select count(*) as attended
    from (
      select room_id,
        sum(extract(epoch from (coalesce(ended_at, now()) - started_at))) as secs
      from public.listener_segments
      where user_id = uid
      group by room_id
    ) s
    where secs >= 900
  ) a on true
  on conflict (user_id) do update set
    comments_count = excluded.comments_count,
    upvotes_raw = excluded.upvotes_raw,
    upvotes_weighted = excluded.upvotes_weighted,
    downvotes_raw = excluded.downvotes_raw,
    downvotes_weighted = excluded.downvotes_weighted,
    fan_score = excluded.fan_score,
    matches_attended = excluded.matches_attended,
    updated_at = now();
$$;

-- full recompute (nightly self-heal + weighting changes)
create or replace function public.recompute_all_profile_stats()
returns void
language sql
as $$
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
    greatest(0, coalesce(c.comments, 0) + coalesce(v.up_w, 0) - coalesce(v.down_w, 0))::int,
    coalesce(a.attended, 0),
    now()
  from public.profiles p
  left join (
    select user_id, count(*) as comments
    from public.chat_messages where hidden_at is null group by user_id
  ) c on c.user_id = p.user_id
  left join (
    select m.user_id,
      count(*) filter (where mv.value = 1) as up_raw,
      coalesce(sum(mv.weight) filter (where mv.value = 1), 0) as up_w,
      count(*) filter (where mv.value = -1) as down_raw,
      coalesce(sum(mv.weight) filter (where mv.value = -1), 0) as down_w
    from public.message_votes mv
    join public.chat_messages m on m.id = mv.message_id and m.hidden_at is null
    group by m.user_id
  ) v on v.user_id = p.user_id
  left join (
    select user_id, count(*) as attended
    from (
      select user_id, room_id,
        sum(extract(epoch from (coalesce(ended_at, now()) - started_at))) as secs
      from public.listener_segments where user_id is not null group by user_id, room_id
    ) s where secs >= 900 group by user_id
  ) a on a.user_id = p.user_id
  on conflict (user_id) do update set
    comments_count = excluded.comments_count,
    upvotes_raw = excluded.upvotes_raw,
    upvotes_weighted = excluded.upvotes_weighted,
    downvotes_raw = excluded.downvotes_raw,
    downvotes_weighted = excluded.downvotes_weighted,
    fan_score = excluded.fan_score,
    matches_attended = excluded.matches_attended,
    updated_at = now();
$$;

-- these are internal maintenance functions: only the service role should call
-- them (never anon/authenticated via PostgREST RPC)
revoke execute on function public.recompute_profile_stats(uuid) from anon, authenticated;
revoke execute on function public.recompute_all_profile_stats() from anon, authenticated;
