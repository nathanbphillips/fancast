-- Audit H-1: chat moderation was cosmetic — hidden/flagged/purged message
-- bodies were still readable by every client and directly dumpable via the
-- public anon key (the SELECT policy was `using (true)`). Replace it so a
-- hidden row is visible only to the room's commentator and to admins;
-- everyone else (incl. anonymous) cannot read it at all. Non-hidden rows
-- stay world-readable (reading is open, FR-2.4).
drop policy "chat readable by everyone" on public.chat_messages;

create policy "chat readable; hidden rows only to room commentator and admin"
  on public.chat_messages for select
  using (
    hidden_by is null
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.commentator_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );
