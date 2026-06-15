-- M-6 (audit): enforce the FR-4.1 two-guest on-air cap atomically.
-- The talk PATCH accept path counted accepted rows then wrote in a separate
-- statement (TOCTOU): two concurrent accepts of DIFFERENT pending requests
-- could both read on-air<2 and both write -> 3 guests on air. This function
-- re-checks status + cap under row locks in one transaction. Locking the ROOM
-- row (not just the target request) is what serializes accepts of different
-- requests within the same room.
create or replace function public.accept_talk_request(p_request_id uuid)
returns text
language plpgsql set search_path = public as $$
declare
  v_room_id uuid;
  v_status  text;
  v_on_air  int;
begin
  -- lock the target request; serializes concurrent accepts of THIS request
  select room_id, status into v_room_id, v_status
  from talk_requests where id = p_request_id for update;
  if v_room_id is null then return 'not_found'; end if;
  if v_status <> 'pending' then return 'not_pending'; end if;

  -- lock the room row so two DIFFERENT pending requests can't both pass the cap
  perform 1 from rooms where id = v_room_id for update;

  select count(*) into v_on_air
  from talk_requests where room_id = v_room_id and status = 'accepted';
  if v_on_air >= 2 then return 'cap_full'; end if;

  update talk_requests set status = 'accepted' where id = p_request_id;
  return 'accepted';
end $$;

-- callable only by the service role (the route is the authz boundary); Supabase
-- grants public functions to anon/authenticated by default, so revoke explicitly.
revoke execute on function public.accept_talk_request(uuid) from public, anon, authenticated;
grant execute on function public.accept_talk_request(uuid) to service_role;
