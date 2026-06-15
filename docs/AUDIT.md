# Codebase Audit — 2026-06-15

Full-codebase pass (8 review lenses, every finding adversarially verified against code on disk). 27 confirmed findings → ~19 distinct issues after dedupe. **Not yet fixed** — backlog for triage. Severity is post-verification (verifiers re-rated independently).

Many items are bounded by the **single-commentator MVP** (founder is the only commentator + admin) — flagged where that limits today's blast radius vs. latent risk.

---

## HIGH

> **All three HIGH findings fixed in commit `9f6f36d` (2026-06-15).** Verified by `scripts/ssrf-test.ts` (24 unit checks), `scripts/highfix-smoke.ts` (9 integration checks), and the Phase 3 suite as regression. Migration 0011 applied to the DB.

### H-1. ✅ FIXED — Hidden/flagged/purged chat bodies are shipped to every client (moderation is cosmetic)
**Fix:** migration `0011_hide_chat_body_rls.sql` restricts SELECT of hidden rows to the room commentator + admins; `RealtimeRoom` hide handler now blanks `body` in client state.
`app/(app)/room/[id]/page.tsx:84-91`, `db/migrations/0003:28-30`, `components/room/RealtimeRoom.tsx:811-816`
- History load selects `*` (incl. `body`) with no `hidden_by IS NULL` filter; the client only swaps the *rendered* text to "Message hidden" — the real body is in the page/flight payload and React state.
- Worse: the `chat_messages` RLS policy is `using (true)`, so any **anonymous** client with the public anon key can `GET /rest/v1/chat_messages?select=body&hidden_by=not.is.null` and read every hidden/purged message verbatim.
- Defeats FR-8.3/8.4: "removed" abuse stays fully readable. Fix needs server/RLS redaction of `body` when `hidden_by` is set (except for moderators), not just a client tweak.

### H-2. ✅ FIXED — Link unfurler SSRF (`lib/unfurl.ts`)
**Fix:** redirects followed manually with each hop validated *before* the request; every host DNS-resolved and rejected if any address is private/reserved (defeats decimal/hex/octal literals + internal DNS + redirect pivots); https/http only, 4-hop cap.
Two facets, same file:
- **Redirect fires before validation** (`:72-83`): `fetch(url,{redirect:"follow"})` issues the request(s) — including to a public URL that 302s to `http://169.254.169.254/...` or an internal host — and only validates `res.url` *after*. The post-hoc check blocks body parsing, not the request.
- **Weak host blocking** (`:16-24`): blocks only dotted-quad IPs and literal `localhost`/`.local`. Bypassable via decimal/hex/octal IP encodings and internal DNS names (e.g. `metadata.google.internal`).
- Server-side request forgery against cloud metadata / internal services. Fix: resolve+validate each hop (manual redirect handling), block private ranges after DNS resolution, reject non-public hosts.

### H-3. ✅ FIXED — `chat/hide` is not room-scoped — any commentator can hide messages in any room
**Fix:** the route now loads the message's room and requires `room.commentator_id === caller` (or admin); 403 otherwise. Hide is labelled `commentator` vs `admin` accordingly.
`app/api/chat/hide/route.ts:15-46`
- Checks only the **global** `profile.role === "commentator"`; never compares the message's room to `caller.userId`. Every other moderation/clock/room route gates on `room.commentator_id === caller.userId`; this one is the outlier.
- **Severity contested** (verifiers split high/medium): a true authorization hole, but **not exploitable today** because the MVP has one commentator (the founder). Becomes real the moment a second commentator account exists. Fix: load `rooms.commentator_id` for the message's room and require ownership-or-admin.

---

## MEDIUM

> **Status (2026-06-15):** 10 of 12 fixed and verified — M-1, M-2, M-3, M-5, M-6, M-7, M-8, M-10, M-11, M-12 (commits `7614daf`..`12239f7`). **M-9** is code-complete (pure matcher unit-tested) but its end-to-end purge path can't run until the API-Football account is un-suspended — verification deferred. **M-4** (reconnect rehydrate) was deliberately deferred to be isolated and resolved on its own. Each fix ships with a dedicated smoke/unit test (see `package.json` scripts and `scripts/*`).

### M-1. ✅ FIXED — LiveKit token route never checks bans
`app/api/livekit/token/route.ts:28-94`
- Unlike every write route (which goes through `requireParticipant` → consults `bans`), the token route grants `canPublish`/subscribe purely from room ownership / admin / accepted talk-request. A **banned** commentator or guest still gets a publish-capable token, and a banned listener still gets a subscribe token. Audio-layer ban bypass.

### M-2. ✅ FIXED — Open redirect via `next` in the auth callback
`app/auth/callback/route.ts:17,55`
- `next` is taken from the query and passed to `NextResponse.redirect(new URL(next, origin))` with no same-origin check. `next=https://evil.com` or `next=//evil.com` redirects off-site after a real login — phishing vector. Fix: only allow `next` values starting with a single `/`.

### M-3. ✅ FIXED — Non-atomic vote/flag/slider aggregate recompute → counter drift
`app/api/chat/vote/route.ts:54-64`, `app/api/links/vote/route.ts:52-64`, slider
- Pattern is read-modify-write across separate round-trips (upsert vote → SELECT all votes → UPDATE counter) with no transaction/lock. Concurrent voters on the same message/link (the live-room norm) interleave and leave `up_count`/`down_count` drifted from the actual vote rows. Cosmetic-ish but visible and self-perpetuating. Fix: atomic SQL recount (RPC/trigger) or `count`-in-DB.

### M-4. ⏸ DEFERRED (isolate + resolve separately) — Reconnect drops realtime events (two facets)
`components/room/RealtimeRoom.tsx:211-219,304`
- Control channel uses `rewind:"5"` but multiplexes 6 event types; during voting, `slider` events swamp the 5-message window, so a reconnecting client can **miss the `clock`/`state` event** and never re-derive (no DB re-fetch on reconnect). Clock/score can be stuck wrong until the next transition.
- Private channel is attached with **no rewind**, so `question`/`talk_request` events arriving during a commentator disconnect are lost (no re-fetch either). Fix: per-event-type channels or larger rewind + a DB rehydrate on `connected`.

### M-5. ✅ FIXED — Start Broadcast TOCTOU → double egress / orphaned recording
`app/api/rooms/route.ts:201-213`
- State check and state write aren't atomic (no `.eq("state","waiting")` guard, no DB transition constraint). A double-tapped/retried `start` can launch two egresses; one recording row gets orphaned. (Same check-then-write shape as the clock route — see L-1.) Fix: guard the UPDATE on the expected from-state and act only if a row changed.

### M-6. ✅ FIXED — Two-guest on-air cap is TOCTOU
`app/api/talk/route.ts:201-218`
- Accept counts `accepted` rows then writes `accepted` in a separate step; two near-simultaneous accepts both read `onAir=1`, both pass `<2`, both write → 3 guests on air (FR-4.1 violation). Fix: atomic conditional insert/update or a DB constraint.

### M-7. ✅ FIXED — Listeners keep an open LiveKit subscription after End Broadcast
`components/room/RealtimeRoom.tsx` (audioLive gate), `lib/egress.ts:111`
- On wrap, listener audio is stopped only by the rendered `audioLive` UI gate; the LiveKit room is created with `emptyTimeout: 3600` and never deleted on End Broadcast, and the commentator's mic-stop is a separate client action that may not fire (tab close). A determined/edge client could keep receiving. Fix: delete the LiveKit room (or revoke) on End Broadcast.

### M-8. ✅ FIXED — Flag-budget check silently capped at PostgREST's 1000-row default
`app/api/chat/flag/route.ts:46-55`
- Computes the 10-flags-per-match budget by selecting **all** message ids in the room (no limit) then counting flags `.in(...)`. In a >1000-message match the id list is truncated to 1000, so flags on older messages aren't counted — the budget under-counts and a user can exceed 10. Fix: count flags directly with a room-scoped join/RPC, not an id-list round-trip.

### M-9. ◐ CODE-COMPLETE (e2e verification deferred — API-Football suspended) — Seed-fixture purge can fail silently and is swallowed
`lib/fixtures.ts:72`, `db/migrations/0001:83`
- First real API-Football sync does `delete().lt("id",0)` and discards the result. `rooms.fixture_id` FK has no `on delete` (defaults to RESTRICT), and rooms can be opened against seed fixtures, so if any room references a seed the delete errors — silently — and seeds never get cleaned (negative-id placeholders linger alongside real fixtures). Fix: capture the error; reassign/handle rooms on seeds, or block seed deletion meaningfully.

### M-10. ✅ FIXED — "Request to Talk" button stuck disabled for the listener
`components/room/InteractionButtons.tsx:77,105,117`; `app/api/talk/route.ts:233`
- After submitting, the listener's button shows "Request pending" forever: the `talk_update` clear event is published only on the **private** channel, which listeners don't subscribe to. So a dismissed/accepted/completed caller can never request again in that session without a reload. Fix: notify the requester (e.g., a listener-visible event or poll).

### M-11. ✅ FIXED — Account theme preference flashes after hydration on fresh devices
`components/ThemeSync.tsx:11-20`, `app/layout.tsx:27`
- The pre-paint no-flash script only reads `localStorage`; it doesn't know the signed-in user's `theme_pref`. A user whose system theme differs from their account theme sees the page paint one way, then `ThemeSync` flips it post-hydration — a visible flash, against the no-flash requirement. Fix: encode `theme_pref` where the pre-paint script can read it (cookie/SSR class).

### M-12. ✅ FIXED — Chat auto-scroll yanks the user to the bottom on every message
`components/room/RealtimeRoom.tsx:725-728`
- Scrolls to bottom whenever `messages.length` changes with no "is the user near the bottom?" check. During a live match, anyone scrolling up to read history is pulled back down within seconds — reading history is effectively impossible. Fix: only auto-scroll when already pinned to the bottom.

---

## LOW

> **Status (2026-06-15):** L-1, L-2, L-3 fixed alongside the related MEDIUMs. **L-4** deferred — it needs a founder product decision on the escalation threshold, not just code.

- **L-1.** ✅ FIXED (with M-5/L-1, commit `9f31ce6`) — Clock transition check-then-write is non-atomic (`app/api/clock/route.ts`): a same-action multi-tab race can insert a duplicate period-start, nudging the derived clock backward by the request window (self-corrects next transition). Same root as M-5. Now an atomic from→to claim gates the clock_event insert.
- **L-2.** ✅ FIXED (with Batch 6, commit `9f31ce6`) — A wrapped room can never be reopened for the same (fixture, commentator) and `open_waiting` silently returns the dead room instead of signaling "already wrapped" (`app/api/rooms/route.ts:100-102`). Now returns a clear 409.
- **L-3.** ✅ FIXED (with M-11, commit `220ca1d`) — `ThemeSync` writes the account pref into the same `localStorage` key as an explicit device choice, so a passive default becomes a sticky override that won't pick up a later account-pref change (`components/ThemeSync.tsx:14-16`). ThemeSync no longer writes that key.
- **L-4.** ⏸ DEFERRED (needs a product decision) — FR-9.3's "repeat blocklisted-domain attempts flag the account" is unmet — repeat pirates are just re-rejected with no escalation (`app/api/links/route.ts`). Rejection itself works; needs a founder decision on the threshold before implementing.

---

## Cross-cutting themes
1. **Atomicity** — several counter/cap/transition writes are read-modify-write without a guard or transaction (M-3, M-5, M-6, M-8, L-1). A consistent "guarded UPDATE / count-in-DB / RPC" approach would close most.
2. **Reconnect resilience** — the realtime layer leans on rewind windows with no DB rehydrate on reconnect (M-4); the NFR "full replay from DB + channel history" isn't fully met.
3. **Server-side moderation/authz** — moderation redaction (H-1) and room-scoping (H-3) and ban enforcement (M-1) need to live at the server/RLS layer, not the client or a single route.
4. **SSRF** (H-2) is the one classic external-facing security hole.
