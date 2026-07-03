# FanCast PRD (build-facing)

Scope: Arsenal matches only, one room at a time, 10-50 concurrent listeners, responsive web + installable PWA. Roles: listener, commentator (manually granted), admin. Non-goals for MVP: multiple simultaneous rooms, other clubs, native apps, discovery/ranking, producer role, captions, Stripe Connect, video of any kind, image uploads, DMs.

> **Commentator Platform Epic (2026-07-03, FR-18 to FR-26 below) retires three of these non-goals:** multiple simultaneous rooms (now supported), "commentator manually granted" (now self-serve, supersedes FR-2.2), and single-club fixture sync (now league-wide; positioning stays Arsenal-first). Still non-goals: native apps, video of any kind, DMs, captions, producer role.

Room states: `scheduled → waiting → pregame → live_1h → halftime → live_2h → [extra_time] → postgame → wrapped`.

---

## FR-1: Home page and schedule

- 1.1 Home shows the next Arsenal fixture prominently plus all known upcoming fixtures (Sportmonks): date, kickoff localized to viewer timezone, competition, assigned commentator.
- 1.2 Rooms are enterable only in `waiting` or later. Scheduled fixtures render without a join action. A live room renders as the dominant card with LIVE indicator and listener count.
- 1.3 Logged-in users see followed commentators' upcoming sessions first.
- 1.4 When a followed commentator's room enters `waiting`: email to followers (Resend) + in-app notification. *(Extended by FR-21: this becomes the `go_live` type on the notification platform; behavior kept.)*

**AC:** With no live room, home shows schedule with no join affordances. Within 10s of `waiting`, home shows the room as joinable and notifications dispatch.

## FR-2: Auth, roles, follows

- 2.1 Supabase magic-link email + OAuth. Unique username at first login, changeable once per 30 days.
- 2.2 Roles: listener (default), commentator (manual grant), admin (founder). *(SUPERSEDED by FR-18.1: commentator becomes a self-serve upgrade with terms acceptance; admin grant remains as a backstop.)*
- 2.3 Follow commentators; counts on profile and room header.
- 2.4 Reading is open: anonymous visitors can listen and view chat/stats/links. All writes require an account; anonymous users see a join prompt where inputs would be.

**AC:** Anonymous visitor hears audio within two taps from home ('tap to listen' overlay satisfies autoplay policy). Signup-to-first-message under 60 seconds.

## FR-3: Room lifecycle, waiting room, Start control

- 3.1 `scheduled`: listed on home, not enterable, no chat exists.
- 3.2 `waiting`: begins when commentator presses **Open Waiting Room**. Room becomes enterable. Listeners see match header, countdown to kickoff, commentator presence, read-only chat. **Only the commentator can post in waiting state** (rendered with commentator styling). Audio optional (mic toggle); audio bar shows "Waiting for the show to start" when silent.
- 3.3 **Start Broadcast** (commentator bar, requires live mic) → `pregame`. Unlocks chat, links, questions, talk requests, widgets for everyone. Starts the session recording.
- 3.4 Transitions: clock Start 1H → `live_1h`; Stop 1H → `halftime`; Start 2H → `live_2h`; Stop 2H → `postgame` (or `extra_time` when marked); **End Broadcast** → `wrapped` (stops recording, locks writes, shows follow prompt, then downloads panel).
- 3.5 If no commentator goes live, room stays `scheduled`; nothing 404s.

**AC:** Waiting-room listener sees countdown and commentator messages but cannot type. Within 1s of Start, inputs unlock on all connected clients without reload.

## FR-4: Audio broadcast, call-ins, technical difficulties

- 4.1 One LiveKit room per match room; commentator publishes mono audio; max on-air = commentator + 2 guests.
- 4.2 Request to Talk: one-line topic + consent checkbox on first use per account (copy in `docs/LEGAL_PAGES.md`). Cards appear in commentator bar center zone with Accept/Dismiss. Dismissal is silent to requester. Accept elevates LiveKit publish permission.
- 4.3 On-air listener bar: ON AIR badge, mute toggle, dominant red **Leave Air** button (instant self-removal). Commentator can remove via speaker chip X.
- 4.4 No dump button / broadcast delay. On-air eligibility gates: account >48h old, ≥5 prior chat messages any session, never previously removed from air.
- 4.5 **Technical difficulties:** on commentator disconnect (or 10s without audio frames while unmuted), all listeners see a non-blocking "Technical difficulties — the commentator will be right back" card in the audio bar area. Chat, votes, links, stats, widgets, and clock all continue (clock is client-derived from last event). Guests stay on air. On reconnect the card clears within 2s; recording continues into the same file. After 15 minutes a soft banner notes the broadcast may have ended; the room does not close.

**AC:** Killing the commentator's network mid-sentence shows the card within 5s, chat keeps flowing, reconnect resumes audio with no listener action.

## FR-5: Background audio and radio mode (all MVP scope)

- 5.1 MediaSession API: lock-screen controls, title, commentator, artwork.
- 5.2 Installable PWA: manifest, service worker (built push-ready), offline shell for home, gentle install prompt after a completed session.
- 5.3 Continuous HLS egress of the room mix while live; radio mode plays HLS in a plain `<audio>` element. 5-15s latency is acceptable for non-watching listeners.
- 5.4 Radio-Only toggle: switches to HLS, hides sync controls, enlarges stats, keeps clock. Propose radio mode when WebRTC playback stalls in background.
- 5.5 Phase 5 tests both paths on iOS Safari and Android Chrome, 15-minute locked-screen runs.

**AC:** Radio-mode listener on iOS with locked screen hears continuous audio for 15 minutes and can pause/resume from the lock screen.

## FR-6: Sync (deep buffer + one-tap calibration)

Web Audio ring buffer holding up to 90s of incoming WebRTC audio; playback reads at a configurable offset. Buffer fills from join; UI communicates available depth.

- 6.1 Default offset 0 (live edge).
- 6.2 **Sync to my TV:** tapping the sync readout opens a sheet with the commentator match clock ticking large: "When your TV shows this exact moment, tap Now." Offset = commentator clock − tap moment; applied immediately, persisted per session. Sheet also offers Live Edge reset and steppers.
- 6.3 ±0.5s steppers on the audio bar; numeric offset display (e.g., `+42.5s`).
- 6.4 If requested offset exceeds buffered depth, apply max available and auto-complete as buffer fills (brief toast).
- 6.5 Sync controls hidden in radio mode.

**AC:** Listener on a feed 45s behind the commentator reaches alignment within 1s accuracy in a single calibration pass (tested against a deliberately delayed feed).

## FR-7: Match clock with integrated room state

One component, two presentations, never both:

- 7.1 During `live_1h`/`live_2h`/`extra_time`: period label beside running clock — `1H 23:14`, `2H 78:40`, `ET 104:12`. Counts past 45:00/90:00 freely.
- 7.2 Outside live play: the clock element is **replaced** by the state word: PRE-GAME, HALFTIME, POST-GAME, FULL TIME. No zeroed clock ever.
- 7.3 Commentator controls: Start/Stop 1H, Start/Stop 2H, ±1s adjust. Events carry server timestamp + offset; clients derive locally, resync per event.
- 7.4 Clock transitions drive room state (FR-3.4) and auto segment markers (FR-13.3).

**AC:** Simulated full match never shows state word and running clock simultaneously; reconnect mid-half restores correct time.

## FR-8: Chat

- 8.1 Text-only, chronological, Ably with history replay on reconnect.
- 8.2 **Every message shows up/down arrows + net count, always visible.** Social signal only; never affects ordering/visibility. One vote per user per message, changeable.
- 8.3 Flag-to-hide (separate from votes): flags weighted by standing (accounts <48h or no session history = 0.5; established = 1.0); weight ≥3.0 hides pending review. Flag budget: 10 per user per match. All hides logged.
- 8.4 Commentator instant-hide on any message. Admin: ban (account + device fingerprint), purge user's session messages.
- 8.5 Rate limit: 1 msg / 2s, burst 3.
- 8.6 **Commentator messages styled distinctly** (accent left border, gold name, COMMENTATOR badge); lighter variant for on-air guests while they hold the mic. Waiting room uses the same styling.

**AC:** Votes propagate <1s; weighted-flag hide propagates <2s; commentator messages identifiable in a 50-message scroll without reading names.

## FR-9: Links feed

- 9.1 Signed-in users paste URLs; server-side OG unfurl renders compact preview cards (thumbnail, title, domain). Links only.
- 9.2 Votes per card; hidden when downvotes:upvotes > 2:1 AND total ≥5.
- 9.3 Admin-editable domain blocklist (piracy/malware) rejects at submission with guideline-citing message; repeat attempts flag the account.
- 9.4 Identical feed for all roles.

**AC:** Paste-to-card <3s for Bluesky/X/YouTube/news; blocklisted domain rejected with correct message.

## FR-10: Questions and preference slider

- 10.1 Ask Question → commentator's Questions tab (center column, unread badge, newest-on-top, acknowledge/dismiss). Private to author + commentator.
- 10.2 Commentary↔Discussion slider 0-100 per listener; room aggregate meter visible to everyone. Advisory only.

**AC:** Question-to-badge <1s; aggregate updates <5s.

## FR-11: Stats, lineups, tab control

- 11.1 Sportmonks polling (60s live; 15s around kickoff and goal events): score, events timeline, compact stacked stat bars; Home XI / Away XI tabs with formations and subs.
- 11.2 Commentator pushes a tab to all listeners (silent, control channel); listeners can switch back.
- 11.3 Radio mode renders stats larger with more visible refresh.

**AC:** Goal appears in timeline within 90s of being scored; tab push lands on all clients <1s.

## FR-12: Match-day widgets

- 12.1 Score predictor (pregame): one scoreline per listener; aggregate distribution shown; resolves at FT.
- 12.2 Halftime poll: commentator poses one templated question (2-4 options); live results during halftime.
- 12.3 Player ratings (postgame): tap-to-rate starters + used subs 1-10; live aggregate card.

**AC:** Each widget one tap / short form; live aggregates; read-only results when closed.

## FR-13: Segment markers and audio downloads

Segments: pre-game show, first half, halftime show, second half, extra time (when present), post-game show.

- 13.1 **Segment button** on commentator bar opens one-tap next-transition list (e.g., during pregame: "End pre-game / Start first half"). Tap records a `broadcast_marker` (server ts + label) and advances room state where applicable.
- 13.2 Full marker set: start/end of each segment. Start/End Broadcast open/close the outermost span.
- 13.3 Clock actions emit markers automatically (Start 1H = end pregame + start 1H; Stop 1H = end 1H + start halftime show; Start 2H = end halftime + start 2H; Stop 2H = end 2H + start postgame). Manual marks within 30s of an automatic one merge. Post-session, commentator can adjust any marker ±2 min in the downloads panel before cutting.
- 13.4 Recording is the **room mix** (commentator + guests as heard live), so segments include call-ins.
- 13.5 **Downloads panel** (commentator, on `wrapped`, target <15 min processing): full broadcast MP3 + one MP3 per segment, named `FanCast - Arsenal vs Chelsea - 2026-08-15 - 03 Halftime Show.mp3` (brand string from config), each with duration/size, individual downloads + zip. Processing-status view if early.
- 13.6 Rights notice: recordings belong to the commentator, no platform license. Optional copyable courtesy line.
- 13.7 Implementation: continuous LiveKit room-composite egress → storage; post-session ffmpeg job cuts at (marker ts − recording start ts); signed URLs scoped to commentator.

**AC:** Test session with two call-ins and all markers yields full file + six correctly bounded segments including guest audio; marker adjustment re-cuts affected segments.

## FR-14: Recording pipeline

- 14.1 Records Start→End Broadcast; survives commentator disconnects (egress records the room).
- 14.2 Private to commentator + admin in MVP.
- 14.3 Retention 90 days unless pinned.

## FR-15: Tipping (Stripe) *(extended by FR-25.6: in co-hosted rooms the listener picks which host receives the tip; no payout splitting)*

- 15.1 Tip button (profile + room header) → sheet: one-time presets $3/$5/$10/custom (Checkout) and monthly $3/$5/$10 (Billing). Apple Pay / Google Pay enabled.
- 15.2 Single-commentator MVP: funds settle to platform account; tips recorded per commentator so Connect adds later without migration.
- 15.3 Recurring supporters get a supporter badge (chat + profile); manage via Stripe customer portal link in settings.
- 15.4 Quiet UI: never interrupts; one gentle prompt at the post-game follow moment. Platform fee % displayed transparently in the sheet.

**AC:** Test-mode one-time and recurring end-to-end incl. cancellation; badge appears <1 min after subscribing.

## FR-16: Notifications *(SUPERSEDED by FR-21: the notification platform. Where FR-16 defined behavior, FR-21 keeps it and adds types, preferences, batching, and dedupe. Web push moves from v1.1 into FR-21 v1.)*

- 16.1 In-app: followed commentator goes live.
- 16.2 Email (Resend): going-live to followers, one-click unsubscribe. Transactional only.
- 16.3 Web push is v1.1; service worker built push-ready.

## FR-17: Retention instrumentation

- 17.1 `listener_segments` per join/leave incl. rejoins + listening mode. Nightly computation of session duration, peak concurrency, retention ratios. No UI in MVP; weekly founder query covers: median % of session listened, return rate within two fixtures, % of room participating, call-in count, tips.

---

# Commentator Platform Epic (2026-07-03)

FR-18 to FR-26 below come from the Commentator Platform Epic (spec: `..\Commentator Platform Epic\`, one PRD per FR block; migrations pre-assigned 0026 to 0032). Cross-cutting rules: all repo golden rules hold; every host permission check routes through a single `isRoomHost(userId, roomId)` helper once FR-19 lands; the attendance copy rule is load-bearing ("attend" only ever attaches to the room, never the match); notification batching dedupe key is (recipient, room, type).

## FR-18: Commentator accounts and profiles *(PRD-01; supersedes FR-2.2 manual grant; migration 0026)*

- 18.1 **Self-serve upgrade.** A signed-in listener can become a commentator from settings (and from a "Become a commentator" entry on their own profile): explain hosting, present commentator terms (per `docs/LEGAL_PAGES.md` conventions: recording ownership, no-rebroadcast), require a checkbox, then set `role = 'commentator'`. Record `commentator_terms_accepted_at` + `commentator_terms_version`. Admin grant still works.
- 18.2 **Admin suspend.** Admin reverts a commentator to listener from the admin panel. Suspension cancels their scheduled rooms (RSVP holders and followers notified per FR-21 once it exists; before that, silent). The suspension itself is never announced.
- 18.3 **Root profile URLs.** Profiles move from `/u/[username]` to `/{username}` (dynamic route beneath all static routes); `/u/[username]` 301-redirects permanently. A reserved-username list (in `lib/reserved-usernames.ts` or `lib/config.ts`, enforced in the username zod schema) blocks every current top-level route, plausible future routes, and infrastructure names. Migration asserts no existing username collides.
- 18.4 **Profile sections, all users.** Avatar, username, member-since. Matches attended + fan score render once FR-24 ships (clean insertion points). Friend button once FR-23 ships.
- 18.5 **Profile sections, commentators only.** About text (max 280 chars, plain text); social links (fixed set: X, Instagram, YouTube, TikTok, Twitch, personal website; validated https URLs, no shorteners; rendered as icons); follower count; "Upcoming rooms" list (scheduled + live, chronological; hidden when empty). Below these, a reserved stats region: a quiet horizontal strip rendering nothing in v1, held for future data so its arrival does not reflow the page.
- 18.6 **Report action.** Any signed-in user can report a profile (reason picklist + optional note) into the existing moderation surface. Admin can clear about text or social links the same way avatars are cleared.

**AC:** A listener upgrades and sees hosting controls in one session with no admin involvement. `/{username}` renders for a valid user, 404s for unknown, and every reserved word routes to its page, never a profile. `/u/{username}` 301s. Commentator profiles show about/socials/upcoming; listener profiles never show commentator sections. The reserved region renders zero visible UI.

## FR-19: Room creation and scheduling *(PRD-02; depends on FR-18; migration 0027)*

- 19.1 **Create flow.** A commentator picks a fixture from a chronological list of upcoming games in the fixtures cache (date, kickoff local to viewer, competition, teams). Past fixtures and ones they already host are excluded. Data the API provides is never asked of the user.
- 19.2 **Inputs.** Exactly two: broadcast start time (default kickoff minus 15 minutes, adjustable; writes `rooms.broadcast_start`) and an optional one-line blurb (max 140 chars). Title derives at render time from fixture + host, never stored.
- 19.3 **Room slug.** On creation, `slugify("{home} vs {away} {dd-MMM-yyyy} {creator-username}")`, lowercase kebab, date in Europe/London. Immutable, unique index; on collision append `-2`. Canonical URL `/room/{slug}`; `/room/{id}` 301s to it. A later co-host never alters the slug.
- 19.4 **room_hosts schema now, single-host UX now.** New `room_hosts` join table; creation writes the creator as an accepted host. `rooms.commentator_id` remains as creator-of-record, but all permission checks move to a shared `isRoomHost(userId, roomId)` helper reading `room_hosts`. v1 UI stays single host; FR-25 adds invites.
- 19.5 **Fixture sync expansion.** Sync switches from Arsenal-only to all EPL fixtures (league id 8), horizon today + 120 days. Scheduled trigger: cron every 6 hours (the Phase 7 deferral comes due); the manual admin trigger stays. Sync detects kickoff and status changes (postponed, canceled) and updates fixture rows.
- 19.6 **Fixture-change handling.** When a fixture with scheduled rooms moves: shift each room's `scheduled_kickoff` and `broadcast_start` by the same delta; notify hosts + RSVP holders (batched, one per recipient). Postponed with no new date: room flagged postponed, drops from date listings, not canceled; host may cancel.
- 19.7 **Cancel and no-show.** A host can cancel a scheduled room (confirmation required; RSVP holders notified). A room never opened by kickoff + 15 minutes disappears from listings; auto-cancel at kickoff + 2h. No penalties in v1. Extends FR-3.5.
- 19.8 **Non-API games** are unsupported: the picker is the only path to a room.

**AC:** Create-to-scheduled in under 30 seconds touching only the two inputs. The room resolves at `/room/{slug}` and the old id URL 301s. Two commentators can each hold a room on the same fixture; the same commentator cannot duplicate one. After a sync where a fixture moved, the room's countdown and listings reflect the new time without manual action. A room unopened 15 minutes after kickoff is absent from home and matches listings.

## FR-20: Season hosting *(PRD-03; depends on FR-19; migration 0028)*

- 20.1 **Subscribe.** From the fixture picker (and any fixture row), a commentator chooses "Host all {team} games in {competition} this season": creates a subscription and immediately auto-creates scheduled rooms (default broadcast start, no blurb) for every matching future fixture in the cache. Already-hosted fixtures are skipped.
- 20.2 **Future fixtures follow.** Each sync auto-creates rooms for newly appearing fixtures matching an active subscription; rescheduled dates follow via FR-19.6.
- 20.3 **Competition scoping.** One team in one competition for the current season; the option renders only for competitions present in the fixtures cache.
- 20.4 **My rooms management.** Dashboard groups upcoming hosted rooms by month, shows subscription provenance, supports per-row cancel and bulk select + cancel, lists active subscriptions with Unsubscribe. Unsubscribe cancels future subscription-created rooms (RSVP holders notified, batched); past and live rooms untouched.
- 20.5 **Collision warning.** Rooms the same host has within 3 hours of each other's kickoff get a warning badge on the dashboard. Warn only, never block.
- 20.6 **Season end.** Subscriptions lapse when the season's last cached fixture passes. No auto-renew.
- 20.7 **Batching (hard requirement).** Subscribing produces exactly one confirmation to the host and, once FR-21 ships, at most one summary notification per follower. Unsubscribe likewise. Per-room notifications never fire for bulk actions.

**AC:** A season subscription yields one room per cached fixture in under 10 seconds, one confirmation, zero per-room notifications. A new fixture appearing in sync yields its room without user action. Unsubscribe cancels exactly the future subscription-created rooms and nothing else.

## FR-21: Notification platform and follower notifications *(PRD-04; depends on FR-19; supersedes/extends FR-16 and FR-1.4; migration 0029)*

- 21.1 **Channels.** Email via Resend + web push via the PWA service worker (`push_subscriptions` per device; iOS requires the installed PWA; unsupported contexts are a silent no-op with a settings hint). No in-app inbox in v1.
- 21.2 **Type registry** (each type has independent email and push toggles in settings): `room_scheduled` (followers, on creation, bulk = one season summary; email on, push on), `pre_start_reminder` (followers, 15 min before broadcast_start; email off, push on), `go_live` (followers, room enters waiting, keeps FR-1.4; on/on), `rsvp_reminder` (RSVP holders, 30 min before broadcast_start; on/on), `room_change` (hosts + RSVP holders, fixture moved/postponed/canceled; on/on), `cohost_invite`/`cohost_response` (FR-25; on/on), `friend_request` (FR-23; on/on), `friend_accept` (FR-23; email off, push on).
- 21.3 **Batching and dedupe.** Dedupe key (recipient, room, type): a user following both co-hosts gets one notification. Bulk actions collapse to one summary per recipient. A user who RSVPs to a room whose host they already follow gets the rsvp_reminder, not both reminders.
- 21.4 **Delivery.** Outbox table written by the triggering API route; a cron drainer (every minute) sends due rows, marks attempts, retries transient failures. Scheduled timings are computed into the outbox at RSVP/schedule time and recomputed when a room moves.
- 21.5 **Compliance.** Every email has a one-click unsubscribe link that disables that type's email channel (no login, signed token). Settings gains a Notifications section listing every type with its two toggles.

**AC:** Follow a commentator, they schedule one room: exactly one room_scheduled email + push. Season-subscribe 38 games: exactly one summary. RSVP: email + push land 30 min before broadcast_start and re-land correctly if the fixture moves. The unsubscribe link kills that email type only, in one click. A follower of both co-hosts gets exactly one go_live push.

## FR-22: RSVPs and counts *(PRD-05; depends on FR-19 and FR-21; migration 0030)*

- 22.1 **RSVP.** Scheduled rooms carry a "Count me in" button for signed-in users; tapping again removes it. RSVP schedules the rsvp_reminder. Anonymous users see the button as a join prompt (FR-2.4).
- 22.2 **Counts.** Scheduled rooms show the RSVP count; from `waiting` onward the same slot shows the live listener count. Tabular numerals, updates without reload (denormalized `rsvp_count`, recomputed on every write).
- 22.3 **String table (load-bearing copy).** The object of "attend" is always the room; "attend this match" / "attend the match" never renders. 0 RSVPs: button only, no count line. 1: "1 person planning to attend". N of 2 or more: "{N} people planning to attend". Friend layer (FR-23 data): 1 friend: "{N} people planning to attend, including Sarah"; 2: "... including Sarah and Dave"; 3+: "... including Sarah and {k} friends"; all friends and nobody else (N == k+1 <= 3): "Sarah and Dave are planning to attend". Friend avatars render as chips beside the string. Live: "{N} listening now". All strings live in one module (`lib/strings/attendance.ts`) with unit tests; no component composes attendance copy ad hoc.
- 22.4 **Matches page restructure.** `/matches` groups fixtures under date headers (Today, Tomorrow, then "Sat 5 Jul"). Each fixture is a header row with its rooms beneath: host badge(s), blurb, count string, RSVP or Join. Fixtures with no rooms render as today. Home teaser cards adopt the same room-row pattern. Extends FR-1.1/1.2.
- 22.5 **Deferred by decision:** filters, team pills, search, threshold hiding of low counts.
- 22.6 **Privacy.** An RSVP is visible as a friend chip only to accepted friends; otherwise it exists only inside the aggregate. No public attendee list.

**AC:** RSVP toggles optimistically with toast on failure and the count moves on all connected clients. A room crossing into waiting flips to "listening now" without reload. Every attendance string comes from the strings module; a repo grep for "attend the match" / "attend this match" in UI code returns nothing. The matches page groups correctly across a month boundary; a fixture with three rooms lists all three under one header.

## FR-23: Friends and blocking *(PRD-06; depends on FR-22 surfaces; friendship carries no messaging, DMs stay a non-goal; migration 0031)*

- 23.1 **Request and accept.** Add friend from any profile (and popovers, FR-26). One pending request max per pair in either direction. Addressee sees pending requests in settings (+ friend_request via FR-21); accept creates the friendship; decline is silent (requester sees "Requested" indefinitely). After a decline the requester cannot re-request; the declining side can initiate later.
- 23.2 **Unfriend.** Either side, instant, silent.
- 23.3 **Rate limits.** Max 20 friend requests per day per user; requests blocked toward users who declined you.
- 23.4 **Blocking.** Block from profile or popover overflow. Blocking severs any friendship, blocks requests both ways, removes both from each other's friend chips, and hides the pair's RSVP presence from each other (each still counts in aggregates). Unblock from settings. Block state is invisible to the blocked user (requests appear to send, silently dropped).
- 23.5 **Surfaces.** Friend button states: Add friend / Requested / Friends (tap for unfriend confirm). Settings gains Friends (owner-only list, unfriend) and Blocked (unblock). Friend chips + string variants per FR-22.3 resolve through a viewer-scoped endpoint.
- 23.6 **Reporting.** FR-18.6's profile report covers harassment; no new surface.

**AC:** Full double opt-in round trip with correct states on both sides. A declined requester sees no change and cannot re-request. A blocked user's requests silently vanish and neither side appears in the other's chips. The 21st request in a day is rejected with a clear message. Friend lists are invisible to anyone but the owner (RLS and API both).

## FR-24: Fan score and profile history *(PRD-07; depends on FR-18; raw material: weighted votes 0019 + listener_segments 0016; migration 0032)*

- 24.1 **Formula.** `fan_score = max(0, comments_sent + weighted_upvotes_received - weighted_downvotes_received)`. Comments = non-hidden chat messages authored (replies included). Votes use existing established-account weighting. Floored at zero.
- 24.2 **Components stored.** Raw + weighted up/down totals and comment count persist alongside the score, racked for future badges and levels.
- 24.3 **Matches attended.** A room counts as attended at 15+ cumulative minutes in `listener_segments`. Profile shows the total and the most recent 10 (teams, date, host), public in v1. Hosts' own rooms count.
- 24.4 **Display.** One prominent "Fan score" number on the profile (tabular numerals) with the attended count beside it. No leaderboards, no rank, no score in chat in v1.
- 24.5 **Recompute.** Incremental bumps on message create/hide and vote create/change, plus a nightly cron full recompute to self-heal drift. Never computed on page load.
- 24.6 **Anti-gaming.** Existing protections carry the weight: vote weighting, vote rate limits, no self-votes (verify a guard exists on the vote routes; add if absent). Hidden messages subtract.

**AC:** Score equals the formula recomputed by hand from the DB. A hidden message and its votes drop out within the nightly cycle or on the hide event. A 20-minute listen adds one attended match; 5 minutes adds none. Heavy downvotes floor at 0, never negative.

## FR-25: Co-hosting *(PRD-08; depends on FR-19 schema + FR-21 invites; supersedes single-commentator phrasing in FR-3/FR-4; max on-air becomes hosts + 2 guests)*

- 25.1 **Invite.** The creating host invites one co-host by username from the room's manage view (invitee must be a commentator). Invitee gets cohost_invite + an accept/decline surface on their dashboard. Accept writes an accepted `room_hosts` row; decline notifies the inviter. Pending invites visible only to the two parties. Either host can withdraw/leave; re-send after decline once. Cap: 2 accepted hosts in v1 (schema supports N).
- 25.2 **Equal permissions, no primary.** Every host-gated action routes through `isRoomHost()`: open waiting, start/end broadcast, clock and state, waiting toggles, stats pushes, moderation, caller accept, cancel semantics. Includes an explicit audit checklist of every current `commentator_id` comparison, each converted and tested.
- 25.3 **Concurrency.** Both hosts pressing controls is safe: idempotent transitions (duplicate = no-op; out-of-order guard exists), two accepts of one caller resolve to one elevation.
- 25.4 **Display.** Accepted hosts render together everywhere ("with @a and @b" on cards and the room header); both profiles list the room; both histories count it (FR-24.3). Solo display until acceptance. Slug never changes.
- 25.5 **Leave and cancel.** Leaving a scheduled room removes the host; the room continues with the remaining host. The last host leaving = cancel (RSVP holders notified). During waiting/live, End Broadcast keeps its meaning and either host can trigger it; a disconnect is not an end.
- 25.6 **Tips.** In a co-hosted room the tip sheet shows both hosts and the listener picks the recipient; each tip routes 100% (minus platform fee) to the chosen host. No splitting. Single-host rooms keep the FR-15 flow untouched.
- 25.7 **Recordings.** Both hosts get full access to recordings and downloads; ownership applies jointly. Extends FR-13/14 access via `isRoomHost()`.
- 25.8 **Notifications.** Followers of either host get room notifications; (recipient, room, type) dedupe guarantees one per person.

**AC:** Invite, accept, both-badge display end to end. With host A absent, host B alone runs an entire session. Simultaneous Start presses yield one transition. A tip lands with the chosen host and is attributed in their history. A follower of both hosts gets exactly one go_live push. Last-host-leaves cancels and notifies RSVPs.

## FR-26: Profile popovers *(PRD-09; depends on FR-18 and FR-23; ships last)*

- 26.1 **Commentator badge popover.** Tapping a host badge (room header, waiting card, chat commentator styling) opens a popover: avatar, username, about snippet (first 100 chars), follower count, Follow button (optimistic), View profile link. Never interrupts audio; client-rendered over the room.
- 26.2 **Listener avatar popover.** Tapping any chat avatar opens the same shape: avatar, username, fan score, matches attended, Add friend button (FR-23 states), View profile link.
- 26.3 **View profile navigation.** Desktop: new tab. Mobile: same tab only because background audio survives navigation per FR-5; if room audio does not survive the round trip on iOS Safari, open a new tab there too (iOS Safari is the cert gate).
- 26.4 **Overflow actions.** Report (FR-18.6) and Block (FR-23.4) for listeners; Report for hosts.
- 26.5 **Behavior.** One popover at a time; dismiss on outside tap or Esc; content cached once per user per session; no popover for your own avatar. Anonymous viewers see Follow / Add friend as the join prompt (FR-2.4).

**AC:** Opening and dismissing during live audio never audibly interrupts playback (verify on iOS Safari). Follow and Add friend work from the popover with optimistic states + toast on failure. Block takes effect immediately. Keyboard and screen-reader accessible (focus trap, labeled trigger).

---

## Non-functional requirements

- WebRTC mouth-to-ear <500ms at live edge; control messages <1s; HLS <20s.
- 50 concurrent MVP; clean architecture to 1,000 (SFU + HLS offload).
- Reconnect resilience: full replay from DB + channel history; no data loss on cold starts.
- Browsers: iOS Safari (current, -1), Android Chrome, desktop Chrome/Edge/Firefox/Safari. iOS Safari gates audio features.
- WCAG AA contrast both themes; keyboard operability; 44px targets; visible focus; reduced motion.
- RLS on all tables; questions/talk_requests visible only to author + commentator; signed URLs for recordings; no third-party tracking.
