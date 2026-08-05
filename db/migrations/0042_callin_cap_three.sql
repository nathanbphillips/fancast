-- Raise the on-air call-in cap from 2 guests to 3 (founder 2026-08-05, ahead of
-- the first live test). Supersedes FR-4.1's "max on-air = commentator + 2
-- guests" -> now commentator(s) + 3 guests.
--
-- Identical to 0013 apart from the threshold: the atomic re-check under row
-- locks (M-6) is what stops two concurrent accepts both passing the cap, so the
-- locking must be preserved exactly.
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
  if v_on_air >= 3 then return 'cap_full'; end if;

  update talk_requests set status = 'accepted' where id = p_request_id;
  return 'accepted';
end $$;

-- create or replace preserves grants, but re-assert them so a fresh environment
-- built from migrations alone ends up identical (the route is the authz boundary)
revoke execute on function public.accept_talk_request(uuid) from public, anon, authenticated;
grant execute on function public.accept_talk_request(uuid) to service_role;
