-- Phase 11 Slice 2 (security pre-req for the merged stream). Link hiding was
-- cosmetic: a hidden link's row — including its url and OG title/description/
-- image — was still world-readable via the anon key because the SELECT policy
-- was `using (true)`, even though the client filters hidden links out of the UI.
-- This is the same H-1 leak class fixed for chat bodies in 0011. Once link cards
-- sit inline in the chat stream (where users expect 0011-grade hiding), this
-- must reach parity. Replace the policy so a hidden link row is visible only to
-- the room's commentator and to admins; everyone else (incl. anonymous) cannot
-- read it. Non-hidden links stay world-readable (reading is open, FR-2.4).
drop policy "links readable by everyone" on public.links;

create policy "links readable; hidden rows only to room commentator and admin"
  on public.links for select
  using (
    hidden = false
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.commentator_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );
