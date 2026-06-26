-- Phase 11 Slice 4: vote sorting needs (a) a brigading-resistant ranking signal
-- and (b) moderation that cascades through threads.
--
-- (a) Established-account vote weighting. Votes get a `weight` (set by the route
--     from the voter's standing+age, mirroring the flag system); each parent row
--     keeps the RAW up/down counts for display AND a weighted `score` (sum of
--     value*weight) used by the "top" sort, so a few fresh sock-puppets can't
--     drive the ranking. New 4-arg cast functions are ADDED alongside the old
--     3-arg ones (kept so the currently-deployed code keeps working during the
--     rolling deploy — DB ahead of code); the 3-arg versions can be dropped once
--     the new build is fully live.
-- (b) hide_message_subtree: hiding a node cascades hidden_by to its whole
--     descendant subtree (recursive CTE over parent_id) and returns the affected
--     ids so the route can publish a hide per row. Closes the Slice-3 live-vs-
--     reload divergence where a hidden thread kept a visible reply pile.

alter table public.message_votes add column weight numeric not null default 1;
alter table public.link_votes add column weight numeric not null default 1;
alter table public.chat_messages add column score numeric not null default 0;
alter table public.links add column score numeric not null default 0;

-- backfill: existing votes default to weight 1, so the weighted score == raw net
update public.chat_messages set score = up_count - down_count;
update public.links set score = up_count - down_count;

create or replace function public.cast_message_vote(
  p_message_id uuid, p_user_id uuid, p_value smallint, p_weight numeric)
returns table(up int, down int, score numeric)
language plpgsql security definer set search_path = public as $$
declare v_up int; v_down int; v_score numeric;
begin
  perform 1 from chat_messages where id = p_message_id for update;
  if p_value = 0 then
    delete from message_votes where message_id = p_message_id and user_id = p_user_id;
  else
    insert into message_votes(message_id, user_id, value, weight)
      values (p_message_id, p_user_id, p_value, p_weight)
      on conflict (message_id, user_id)
        do update set value = excluded.value, weight = excluded.weight;
  end if;
  select count(*) filter (where value = 1),
         count(*) filter (where value = -1),
         coalesce(sum(value * weight), 0)
    into v_up, v_down, v_score from message_votes where message_id = p_message_id;
  update chat_messages
    set up_count = v_up, down_count = v_down, score = v_score
    where id = p_message_id;
  up := v_up; down := v_down; score := v_score; return next;
end $$;

create or replace function public.cast_link_vote(
  p_link_id uuid, p_user_id uuid, p_value smallint, p_weight numeric)
returns table(up int, down int, score numeric, is_hidden boolean)
language plpgsql security definer set search_path = public as $$
declare v_up int; v_down int; v_score numeric; v_hidden boolean;
begin
  perform 1 from links where id = p_link_id for update;
  if p_value = 0 then
    delete from link_votes where link_id = p_link_id and user_id = p_user_id;
  else
    insert into link_votes(link_id, user_id, value, weight)
      values (p_link_id, p_user_id, p_value, p_weight)
      on conflict (link_id, user_id)
        do update set value = excluded.value, weight = excluded.weight;
  end if;
  select count(*) filter (where value = 1),
         count(*) filter (where value = -1),
         coalesce(sum(value * weight), 0)
    into v_up, v_down, v_score from link_votes where link_id = p_link_id;
  -- FR-9.2 auto-hide retained until a commentator link-hide path exists
  -- (the "links social-signal only" change is deferred to a later slice)
  v_hidden := v_down > 2 * v_up and (v_up + v_down) >= 5;
  update links
    set up_count = v_up, down_count = v_down, score = v_score, hidden = v_hidden
    where id = p_link_id;
  up := v_up; down := v_down; score := v_score; is_hidden := v_hidden; return next;
end $$;

-- cascade-hide a node's whole subtree; returns the rows newly hidden so the
-- route can publish a hide event for each. security definer + service-only.
create or replace function public.hide_message_subtree(
  p_message_id uuid, p_hidden_by text)
returns table(id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with recursive sub as (
    select cm.id from public.chat_messages cm where cm.id = p_message_id
    union all
    select c.id from public.chat_messages c join sub on c.parent_id = sub.id
  )
  update public.chat_messages m
    set hidden_by = p_hidden_by, hidden_at = now()
    from sub
    where m.id = sub.id and m.hidden_by is null
    returning m.id;
end $$;

revoke execute on function public.cast_message_vote(uuid, uuid, smallint, numeric) from public, anon, authenticated;
grant execute on function public.cast_message_vote(uuid, uuid, smallint, numeric) to service_role;
revoke execute on function public.cast_link_vote(uuid, uuid, smallint, numeric) from public, anon, authenticated;
grant execute on function public.cast_link_vote(uuid, uuid, smallint, numeric) to service_role;
revoke execute on function public.hide_message_subtree(uuid, text) from public, anon, authenticated;
grant execute on function public.hide_message_subtree(uuid, text) to service_role;
