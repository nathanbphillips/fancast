# FanCast PRD (build-facing)

Scope: Arsenal matches only, one room at a time, 10-50 concurrent listeners, responsive web + installable PWA. Roles: listener, commentator (manually granted), admin. Non-goals for MVP: multiple simultaneous rooms, other clubs, native apps, discovery/ranking, producer role, captions, Stripe Connect, video of any kind, image uploads, DMs.

Room states: `scheduled → waiting → pregame → live_1h → halftime → live_2h → [extra_time] → postgame → wrapped`.

---

## FR-1: Home page and schedule

- 1.1 Home shows the next Arsenal fixture prominently plus all known upcoming fixtures (Sportmonks): date, kickoff localized to viewer timezone, competition, assigned commentator.
- 1.2 Rooms are enterable only in `waiting` or later. Scheduled fixtures render without a join action. A live room renders as the dominant card with LIVE indicator and listener count.
- 1.3 Logged-in users see followed commentators' upcoming sessions first.
- 1.4 When a followed commentator's room enters `waiting`: email to followers (Resend) + in-app notification.

**AC:** With no live room, home shows schedule with no join affordances. Within 10s of `waiting`, home shows the room as joinable and notifications dispatch.

## FR-2: Auth, roles, follows

- 2.1 Supabase magic-link email + OAuth. Unique username at first login, changeable once per 30 days.
- 2.2 Roles: listener (default), commentator (manual grant), admin (founder).
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

## FR-15: Tipping (Stripe)

- 15.1 Tip button (profile + room header) → sheet: one-time presets $3/$5/$10/custom (Checkout) and monthly $3/$5/$10 (Billing). Apple Pay / Google Pay enabled.
- 15.2 Single-commentator MVP: funds settle to platform account; tips recorded per commentator so Connect adds later without migration.
- 15.3 Recurring supporters get a supporter badge (chat + profile); manage via Stripe customer portal link in settings.
- 15.4 Quiet UI: never interrupts; one gentle prompt at the post-game follow moment. Platform fee % displayed transparently in the sheet.

**AC:** Test-mode one-time and recurring end-to-end incl. cancellation; badge appears <1 min after subscribing.

## FR-16: Notifications

- 16.1 In-app: followed commentator goes live.
- 16.2 Email (Resend): going-live to followers, one-click unsubscribe. Transactional only.
- 16.3 Web push is v1.1; service worker built push-ready.

## FR-17: Retention instrumentation

- 17.1 `listener_segments` per join/leave incl. rejoins + listening mode. Nightly computation of session duration, peak concurrency, retention ratios. No UI in MVP; weekly founder query covers: median % of session listened, return rate within two fixtures, % of room participating, call-in count, tips.

---

## Non-functional requirements

- WebRTC mouth-to-ear <500ms at live edge; control messages <1s; HLS <20s.
- 50 concurrent MVP; clean architecture to 1,000 (SFU + HLS offload).
- Reconnect resilience: full replay from DB + channel history; no data loss on cold starts.
- Browsers: iOS Safari (current, -1), Android Chrome, desktop Chrome/Edge/Firefox/Safari. iOS Safari gates audio features.
- WCAG AA contrast both themes; keyboard operability; 44px targets; visible focus; reduced motion.
- RLS on all tables; questions/talk_requests visible only to author + commentator; signed URLs for recordings; no third-party tracking.
