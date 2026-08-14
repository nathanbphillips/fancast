-- Author-deleted messages must not count toward fan score (audit 2026-08-05).
--
-- Migration 0043 added chat_messages.deleted_at and /api/chat/delete calls
-- recomputeUser() claiming the message "no longer counts" — but this function
-- only filtered hidden_at, so the recompute was a no-op and the claim was false.
-- Identical to 0033 apart from the two added `and deleted_at is null` clauses
-- (one for the comment count, one for the votes those messages received).
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
    where user_id = uid and hidden_at is null and deleted_at is null
  ) c on true
  left join (
    select
      count(*) filter (where mv.value = 1) as up_raw,
      coalesce(sum(mv.weight) filter (where mv.value = 1), 0) as up_w,
      count(*) filter (where mv.value = -1) as down_raw,
      coalesce(sum(mv.weight) filter (where mv.value = -1), 0) as down_w
    from public.message_votes mv
    join public.chat_messages m
      on m.id = mv.message_id
     and m.hidden_at is null
     and m.deleted_at is null
     and m.user_id = uid
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
