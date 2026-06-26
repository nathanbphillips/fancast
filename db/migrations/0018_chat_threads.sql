-- Phase 11 Slice 3: deep threaded replies. Replies are first-class chat_messages
-- rows (so the existing vote/flag/hide RPCs + the :chat channel work for them
-- unchanged) with a thread spine:
--   parent_id  the direct parent (null = top-level message)
--   root_id    the top-level ancestor; equals own id for a top-level message, so
--              an entire thread is one indexed scan: where root_id = <root>
--   depth      nesting depth (0 = top-level)
-- A BEFORE INSERT trigger fills root_id + depth from the parent, so they are
-- always consistent no matter how a row is inserted. Existing rows backfill to
-- top-level (parent null, root = id, depth 0) — fully back-compatible with the
-- currently deployed code, which inserts without parent_id.
alter table public.chat_messages
  add column parent_id uuid references public.chat_messages(id) on delete cascade,
  add column root_id uuid references public.chat_messages(id) on delete cascade,
  add column depth integer not null default 0;

update public.chat_messages set root_id = id where root_id is null;

alter table public.chat_messages alter column root_id set not null;

create index chat_messages_parent_id_idx on public.chat_messages (parent_id);
create index chat_messages_room_root_created_idx
  on public.chat_messages (room_id, root_id, created_at);

create or replace function public.set_chat_thread_fields()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null then
    -- top-level: the column default gen_random_uuid() is already applied to
    -- new.id before this BEFORE-INSERT trigger fires, so a row roots itself
    new.root_id := new.id;
    new.depth := 0;
  else
    select cm.root_id, cm.depth + 1
      into new.root_id, new.depth
      from public.chat_messages cm
      where cm.id = new.parent_id;
    if new.root_id is null then
      raise exception 'reply parent % not found', new.parent_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger chat_thread_fields
  before insert on public.chat_messages
  for each row execute function public.set_chat_thread_fields();
