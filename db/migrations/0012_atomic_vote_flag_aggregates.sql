-- M-3 (audit): make the denormalized vote/flag aggregates atomic.
-- The vote/flag routes did read-modify-write across separate PostgREST
-- round-trips (mutate row -> SELECT all rows -> UPDATE parent counts) with no
-- lock, so concurrent voters/flaggers on the same message/link drifted the
-- cached counts away from the authoritative vote/flag rows. These functions
-- fold each sequence into one transaction and lock the parent row first
-- (SELECT ... FOR UPDATE) so callers targeting the same row serialize. The
-- CLAUDE.md contract is unchanged — aggregates stay denormalized columns
-- recomputed from the vote rows on every write — it is just atomic now.
--
-- SECURITY DEFINER + pinned search_path; callable ONLY by service_role (the
-- route is the authz boundary via requireParticipant, and the function trusts
-- the p_user_id it is handed, so it must never be reachable by anon/authenticated).

create or replace function public.cast_message_vote(
  p_message_id uuid, p_user_id uuid, p_value smallint)
returns table(up int, down int)
language plpgsql security definer set search_path = public as $$
declare v_up int; v_down int;
begin
  perform 1 from chat_messages where id = p_message_id for update;
  if p_value = 0 then
    delete from message_votes where message_id = p_message_id and user_id = p_user_id;
  else
    insert into message_votes(message_id, user_id, value)
      values (p_message_id, p_user_id, p_value)
      on conflict (message_id, user_id) do update set value = excluded.value;
  end if;
  select count(*) filter (where value = 1), count(*) filter (where value = -1)
    into v_up, v_down from message_votes where message_id = p_message_id;
  update chat_messages set up_count = v_up, down_count = v_down where id = p_message_id;
  up := v_up; down := v_down; return next;
end $$;

create or replace function public.cast_link_vote(
  p_link_id uuid, p_user_id uuid, p_value smallint)
returns table(up int, down int, is_hidden boolean)
language plpgsql security definer set search_path = public as $$
declare v_up int; v_down int; v_hidden boolean;
begin
  perform 1 from links where id = p_link_id for update;
  if p_value = 0 then
    delete from link_votes where link_id = p_link_id and user_id = p_user_id;
  else
    insert into link_votes(link_id, user_id, value)
      values (p_link_id, p_user_id, p_value)
      on conflict (link_id, user_id) do update set value = excluded.value;
  end if;
  select count(*) filter (where value = 1), count(*) filter (where value = -1)
    into v_up, v_down from link_votes where link_id = p_link_id;
  -- FR-9.2: hide when downvotes:upvotes exceeds 2:1 AND total votes >= 5
  v_hidden := v_down > 2 * v_up and (v_up + v_down) >= 5;
  update links set up_count = v_up, down_count = v_down, hidden = v_hidden
    where id = p_link_id;
  up := v_up; down := v_down; is_hidden := v_hidden; return next;
end $$;

-- Inserts the flag (a duplicate raises unique_violation 23505, which the route
-- maps to 409), recomputes the weighted total, and hides at >= 3.0 only if not
-- already hidden. Returns the new total and whether THIS flag crossed it (so
-- the route knows to publish the hide event).
create or replace function public.cast_message_flag(
  p_message_id uuid, p_user_id uuid, p_weight numeric)
returns table(weight_total numeric, just_hidden boolean)
language plpgsql security definer set search_path = public as $$
declare v_weight numeric; v_already_hidden boolean;
begin
  perform 1 from chat_messages where id = p_message_id for update;
  insert into message_flags(message_id, user_id, weight)
    values (p_message_id, p_user_id, p_weight); -- 23505 propagates to the route
  select coalesce(sum(weight), 0) into v_weight
    from message_flags where message_id = p_message_id;
  select (hidden_by is not null) into v_already_hidden
    from chat_messages where id = p_message_id;
  just_hidden := (v_weight >= 3.0 and not v_already_hidden);
  update chat_messages set
    flag_weight = v_weight,
    hidden_by = case when just_hidden then 'flags' else hidden_by end,
    hidden_at = case when just_hidden then now() else hidden_at end
   where id = p_message_id;
  weight_total := v_weight; return next;
end $$;

-- Supabase's default privileges grant EXECUTE on public functions directly to
-- anon + authenticated, so revoking from PUBLIC alone is NOT enough — revoke
-- from those roles explicitly, then grant only service_role.
revoke execute on function public.cast_message_vote(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.cast_message_vote(uuid, uuid, smallint) to service_role;
revoke execute on function public.cast_link_vote(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.cast_link_vote(uuid, uuid, smallint) to service_role;
revoke execute on function public.cast_message_flag(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.cast_message_flag(uuid, uuid, numeric) to service_role;
