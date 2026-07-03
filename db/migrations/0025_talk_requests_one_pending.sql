-- One PENDING call-in request per user per room, enforced at the DB (audit
-- 2026-07-02). The route's check-then-insert guard is racy (double-tap / two
-- tabs); duplicates inflate everyone's queue #N and show the commentator two
-- cards for one caller. The API maps 23505 on this index to its existing
-- friendly 409 ("Your request is already in.").
create unique index if not exists talk_requests_one_pending_idx
  on public.talk_requests (room_id, user_id)
  where status = 'pending';
