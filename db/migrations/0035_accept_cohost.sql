-- PRD-08 hardening (adversarial review 2026-07-03): the co-host accept cap was
-- a non-atomic count-then-update, so two invitees accepting the last seat
-- concurrently could both succeed (3 hosts). This RPC serializes accept per
-- room with an advisory xact lock and enforces the cap atomically.

create or replace function public.accept_cohost(
  p_room_id uuid,
  p_user_id uuid,
  p_cap int
)
returns text
language plpgsql
as $$
declare
  v_accepted int;
begin
  -- serialize all accepts for this room
  perform pg_advisory_xact_lock(hashtext(p_room_id::text));

  if not exists (
    select 1 from public.room_hosts
    where room_id = p_room_id and user_id = p_user_id and status = 'invited'
  ) then
    return 'no_invite';
  end if;

  select count(*) into v_accepted
  from public.room_hosts
  where room_id = p_room_id and status = 'accepted';
  if v_accepted >= p_cap then
    return 'full';
  end if;

  update public.room_hosts
  set status = 'accepted', responded_at = now()
  where room_id = p_room_id and user_id = p_user_id and status = 'invited';
  return 'accepted';
end $$;

-- service-role only
revoke execute on function public.accept_cohost(uuid, uuid, int) from anon, authenticated;
