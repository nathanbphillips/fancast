-- Let an author delete their own chat message (founder feedback 2026-08-05,
-- from the first live test: "I would like to be able to delete my comment").
--
-- SOFT delete, deliberately: messages are threaded (parent_id/root_id/depth),
-- so removing a row would orphan its replies. The row survives as a tombstone
-- and the reply chain stays intact, while the CONTENT is genuinely destroyed —
-- the route overwrites body and the link-preview columns rather than merely
-- hiding them, because a user who deletes a comment expects the text gone, not
-- concealed. body has a `char_length >= 1` check, hence the '[deleted]' marker.
--
-- Kept distinct from hidden_by/hidden_at, which is MODERATION (a host or admin
-- acting on someone else) and carries different UI copy and audit meaning.
alter table public.chat_messages
  add column if not exists deleted_at timestamptz;

-- partial index: the client filters tombstones out of the stream constantly
create index if not exists chat_messages_deleted_idx
  on public.chat_messages (room_id, deleted_at)
  where deleted_at is not null;
