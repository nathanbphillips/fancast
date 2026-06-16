# Build Phases (living checklist)

Rules: one phase at a time, in order. A phase is complete when every box is checked and its acceptance test passes. Check boxes in this file as you go; note deviations inline. iOS Safari gates all audio items.

**Current phase: 9** (Phases 1-8 code-complete + verified, incl. Phase 7 stats/lineups on Sportmonks; full audit-hardening pass done (3 HIGH + 11 MED + 3 LOW fixed); match data live via Sportmonks. **Remaining cert gate:** Phase 5 founder device matrix (iOS Safari audio + radio). **Remaining build:** Phase 9 tipping/notifications, Phase 10 hardening + first public session. Production: https://fancast-26.vercel.app)

## Phase 1: Foundation + layout + theming (days 1-3)
- [x] Next.js + TS strict + Tailwind scaffold; deploy pipeline to Vercel *(GitHub repo nathanbphillips/fancast → Vercel auto-deploy on push, live 2026-06-11)*
- [x] `lib/brand.ts` config (name, file-naming template, email sender)
- [x] Token system per docs/DESIGN.md as CSS variables; dark + light themes; header toggle, system default, no-flash load
- [x] Mobile stacked layout shell; desktop three-column shell (stats 25 / chat 50 / links 25)
- [x] Persistent audio bar shell (listener variant, UI only)
- [x] Home page shell with placeholder fixture cards
- **Test:** deployed site renders both themes correctly, responsive at 360px/768px/1280px. ✓ *(Verified 2026-06-11: all three widths and both themes locally incl. toggle/persistence/no-flash; deployed build confirmed serving identical pages, theme script, and both token sets.)*

## Phase 2: Auth + roles + follows + home schedule (days 3-6)
- [x] Supabase auth (magic link + one OAuth provider); username flow (unique, 30-day change lock) *(providers enabled + verified via auth settings API; username flow smoke-tested end-to-end incl. lock; founder's real-inbox signup on prod is the remaining acceptance step)*
- [x] profiles/roles; commentator + admin manual grants *(ADMIN_USER_IDS grants admin at profile creation; `npm run grant-role -- <username> <role>` for manual grants)*
- [x] Follow system; counts on profile and room header *(profile count live; room header count joins in Phase 4 when real rooms exist)*
- [ ] Sportmonks fixtures sync; home schedule with localized kickoff times; enterability gating by room state *(schedule + localization + gating done and verified; sync code built — switched to Sportmonks 2026-06-16, SPORTMONKS_API_TOKEN pending founder subscription)*
- [x] Anonymous read access pattern (inputs replaced by join prompt)
- **Test:** sign up, follow, see schedule; scheduled room not enterable; counts increment. *(All verified 2026-06-11 via scripted smoke test (15/15 checks) + browser pass with temp users; founder's real signup on the deployed site still to do.)*

## Phase 3: Chat + links + moderation (days 6-10)
- [x] Ably setup with token auth; chat channel with presence (watching count) and history replay *(per-room subscribe/presence/history tokens; attach uses rewind for replay; clients never publish — API routes persist to DB then publish)*
- [x] Chat send + votes on every message (always visible) + rate limit *(1/2s burst 3 as a 3-per-6s window)*
- [x] Weighted flag-to-hide (0.5/1.0 weights, ≥3.0 hides, 10-flag budget, hide log)
- [x] Commentator styling variant + instant-hide; admin ban/purge basics
- [x] Links feed: submit → server-side OG unfurl → card; votes; 2:1+5 ratio hiding; domain blocklist
- **Test:** two-browser session covering all of it; blocklisted domain rejected. *(Verified 2026-06-11 via scripted multi-user simulation — 29/29 checks incl. realtime delivery asserted by an independent Ably subscriber — plus an anonymous browser pass with live presence. Founder two-browser session recommended as final confirmation.)*

## Phase 4: Room lifecycle + waiting room + interaction surfaces (days 10-14)
- [x] Room state machine + control channel; DB as source of truth, replay on reconnect *(open_waiting/start/end via /api/rooms; clock-driven transitions arrive with the clock in Phase 6)*
- [x] Waiting room: Open Waiting Room, countdown, commentator-only chat, read-only listeners
- [x] Start Broadcast unlock (all inputs, all clients, <1s, no reload) *(verified live in browser: control event unlocked a listener's page without reload)*
- [x] Questions tab (private channel, badge, newest-first, ack/dismiss)
- [x] Request to Talk flow incl. first-use consent checkbox (copy from docs/LEGAL_PAGES.md); commentator bar cards with Accept/Dismiss *(48h + 5-message gates enforced; "never removed from air" gate waits for speaker_events in Phase 5)*
- [x] Preference slider + public aggregate meter
- [x] Collapsible side panels (commentator); Radio-Only toggle shell
- **Test:** full lifecycle walkthrough with two roles in two browsers. *(Verified 2026-06-11: scripted lifecycle 35/35 checks with independent realtime observer + browser walkthrough of both roles. Founder two-browser session recommended.)*

## Phase 5: Audio + speakers + background listening (days 14-20)
- [x] LiveKit room per match; token route with role grants; commentator publish (mono), listeners subscribe *(verified end-to-end via @livekit/rtc-node: listener received 400+ non-silent frames published by the commentator; mic-source-only grants; tokens refused for wrapped rooms)*
- [x] Commentator self-delay (Web Audio delay node, 1-5s setting) *(mic routes through a DelayNode, adjustable live from the commentator bar; browser audio test = founder)*
- [x] Call-in: permission elevation on Accept; ON AIR bar; Leave Air; speaker chips with X; eligibility gates *(elevation/leave lifecycle + 2-guest cap smoke-tested; Start Broadcast now requires a live mic — FR-3.3 deviation resolved. Amended 2026-06-11: ending a call is neutral; commentator-only caller flags + reversible call-in blocks replace the permanent removal bar.)*
- [x] Technical difficulties card (disconnect or 10s silent-while-unmuted; clears <2s on reconnect; 15-min soft banner) *(detection via participant events + Web Audio RMS analyser; founder network-kill test pending)*
- [x] MediaSession (lock-screen controls/metadata); PWA manifest + service worker (push-ready) + install prompt
- [x] HLS egress while live; radio mode playing HLS in `<audio>` *(verified end-to-end 2026-06-12: real broadcast → egress → rolling playlist + segments served from the public radio bucket; ~100KB segments downloaded. iOS/Android playback check rides with the founder device matrix.)*
- [ ] iOS Safari + Android Chrome locked-screen matrix: 15-min runs on both paths; record results in this file *(founder devices required)*
- **Test:** laptop→phone broadcast; call-in cycle; kill commentator network (card <5s, chat alive, auto-resume); 15-min locked-screen radio run on iOS. *(Server/transport layer machine-verified 18/18 on 2026-06-11; real-device walkthroughs are the founder's next session.)*

## Phase 6: Sync + clock/state component (days 20-23)
- [x] 90s Web Audio ring buffer; offset playback; depth-aware UI *(AudioWorklet ring; effective offset clamps to buffered depth and auto-fills toward the request per FR-6.4; graceful fallback to live-edge playback where worklets/autoplay fail)*
- [x] Sync sheet: ticking reference clock, tap-Now calibration, live-edge reset, ±0.5s steppers, numeric offset display, per-session persistence *(adversarial review: 10 confirmed findings — incl. an iOS false-tech-difficulties bug and a mic-left-capturing-after-drop bug — all fixed; founder's 45s-delayed-feed acceptance test pending)*
- [x] Clock/state unit per FR-7 (period label + clock during play; state word otherwise; never both); ±1s adjustments; event-sourced derivation; reconnect-safe *(14 unit tests on the pure derivation + 16-check simulated full match cycle incl. ET, exactly-once control events, DB-replay reconnect path — all passing 2026-06-11)*
- **Test:** align to a deliberately 45s-delayed feed in one calibration pass (≤1s error); full simulated match clock cycle. *(Clock cycle ✓ scripted; sync calibration pending the ring buffer build.)*

## Phase 7: Stats + lineups + tab control (days 22-26)
- [x] Sportmonks proxy route with cache; polling cadence 60s live / 15s around kickoff+goals *(GET /api/stats/[fixtureId], globalThis TTL 10s cache + in-flight coalescing + last-good; useFixtureStats hook 60s/15s w/ goal-burst)*
- [x] Compact stat bars, events timeline, Home/Away XI tabs with formations and subs *(components/stats/* + StatsPanel container; curated 9-stat allow-list, newest-first timeline, XI by formation line + bench)*
- [x] Commentator push-to-default tab via control channel; listener override *(POST /api/stats-tab -> control `stats_tab` event; pushNonce re-applies; local override clears on each push)*
- [x] Radio-mode enlarged stats variant *(single component, `size` prop from audio.radioActive — no forked tree)*
- **Test:** during any live fixture, stats render correctly in both themes and radio mode; tab push <1s. *(Verified 2026-06-16 against a COMPLETED fixture (no live match available): normalize 18/18 unit (test:stats); smoke7 12/12 (real 9-stat proxy, lineups, cache hit 41ms, id<=0 zeros, push auth 200/403/400); browser — all 3 tabs render real data (stats/events/lineups), no console errors, dark theme holds. Radio enlarged + iOS Safari + a real live match ride with the founder device matrix.)*

## Phase 8: Recording + markers + downloads (days 26-29)
- [x] Room-composite egress → Supabase storage, Start→End Broadcast, disconnect-proof *(combined with radio in one egress — one composite render; recording is MP4/AAC for codec-compat with HLS, transcoded to MP3 in processing)*
- [x] Segment button (next-transition list); auto-markers from clock events; 30s merge rule *(clock transitions auto-emit the full marker set; manual-mark merge rule in `emitMarker`. The clock controls ARE the segment buttons — see deviation log)*
- [x] ffmpeg cut job on wrapped (stream-copy at marker offsets); per-segment files + zip; signed URLs *(ffmpeg-static transcode + `-c copy` cuts; dependency-free STORE zip; signed URLs with brand download filenames)*
- [x] Downloads panel: processing status, file list with names/durations/sizes, ±2 min marker adjust + recut, rights notice + courtesy line *(verified rendering in-browser for a wrapped commentator)*
- **Test:** simulated session with two call-ins and all markers → full file + six correct segments including guest audio; adjust recuts. *(Verified 2026-06-14: marker derivation 5/5 unit tests; processing pipeline 12/12 smoke incl. real audio energy proving guest audio isolated to the 2nd half, six bounded segments, adjust→recut, zip extraction. Live-capture egress proven via smoke:radio + captured MP4 rms. Full single-script e2e — smoke8 — blocked on this machine by a Windows Application Control policy quarantining @livekit/rtc-node's native binding; runs on machines without that policy.)*

## Phase 9: Widgets + tipping + notifications (days 29-32)
- [ ] Score predictor, halftime poll, player ratings (one Supabase table + control events each; live aggregates; read-only when closed)
- [ ] Stripe: Checkout one-time ($3/$5/$10/custom) + Billing monthly ($3/$5/$10); webhook handling; supporter badge; customer portal link; fee % displayed (confirm % with founder)
- [ ] Resend going-live emails to followers + one-click unsubscribe; in-app notification
- [ ] listener_segments instrumentation + nightly metrics computation + founder query pack
- **Test:** full widget cycle in simulated match; test-mode payments end-to-end incl. cancellation; email dispatch on waiting state.

## Phase 10: Hardening + first public session (days 32-33+)
- [ ] Error/loading/empty states everywhere; reconnect drills (kill each service in turn)
- [ ] Rate limits verified; RLS audit (attempt cross-role reads); signed-URL scope check
- [ ] Legal pages from docs/LEGAL_PAGES.md linked in footer/signup; post-match follow prompt
- [ ] Final mobile polish pass; Lighthouse + contrast audit both themes
- [ ] First Bluesky-announced live Arsenal session (10-50 listeners)
- **Test:** full end-to-end during a live match with real listeners.

## Deviation log
(record any spec deviations or assumed decisions here, with date)

- 2026-06-11 — Light-theme `--gold` (#9C824A → #806A3C) and `--green` (#1A9E56 → #137A42) darkened: originals fail WCAG AA for small text on white (3.7:1 / 3.5:1). DESIGN.md authorizes adjusting values rather than breaking contrast; its token table is updated. Dark theme unchanged.
- 2026-06-11 — Audio bar LIVE indicator uses the same white-on-red chip as the match header (red text on dark surface was ~3.9:1).
- 2026-06-11 — Vercel deploy initially failed ("No Output Directory named 'public'"): project was created from an empty repo so framework detection defaulted to "Other". Fixed with `vercel.json` declaring `"framework": "nextjs"`. Vercel project name is `fancast-26`; production domain https://fancast-26.vercel.app.
- 2026-06-11 — Git history rewritten before first push to replace the placeholder author with the founder's real identity.
- 2026-06-11 (Phase 2) — Direct DB connection is IPv6-only and this network is IPv4: migrations run through the session pooler (`aws-1-us-east-1.pooler.supabase.com`) via `npm run migrate`.
- 2026-06-11 (Phase 2) — Added `fixtures` cache table + dev seed fixtures (negative ids) since ARCHITECTURE's data model omitted a fixtures table; first real provider sync purges seeds.
- 2026-06-16 (Phase 2/7) — Match-data provider switched API-Football → **Sportmonks** (v3 football) after API-Football account issues. `lib/fixtures.ts` rewritten for `/fixtures/between/{start}/{end}/{teamId}` (Authorization-header auth, paginated, defensive `mapSportmonksFixture`); env `SPORTMONKS_API_TOKEN`/`SPORTMONKS_BASE`; `lib/config.ts` ids → Arsenal 19 / EPL 8. Verify against the live account with `npm run sportmonks:check`. Mapper unit-tested (`npm run test:sportmonks`).
- 2026-06-11 (Phase 4) — Start Broadcast's "requires live mic" condition (FR-3.3) deferred to Phase 5: no audio pipeline exists yet, so the button starts the show without a mic check.
- 2026-06-11 (Phase 4) — FR-3.3's "unlocks widgets" is moot until widgets exist (Phase 9); chat/links/questions/talk/slider all unlock as specified.
- 2026-06-11 (Phase 4, founder changes) — Waiting-room countdown counts to a commentator-set broadcast start (set in the commentator bar; live-updates via control channel); stats zeroed pre-match; commentator can open chat/links early during waiting via bar toggles. Control-channel `state` handler now ignores out-of-order events (timestamp guard).
- 2026-06-11 (Phase 5) — Commentator self-delay offers Off in addition to the spec's 1-5s settings (the founder won't always be watching delayed).
- 2026-06-11 (Phase 6) — Extra-time flow assumed: Stop 2H → postgame, then optional Start ET (postgame → extra_time) and End ET (→ postgame); ARCHITECTURE's clock action list omitted ET so `start_et`/`stop_et` were added.
- 2026-06-11 (cleanup) — Removed the Phase 1 static demo room (`/room/demo` + AudioBar/RoomShell/ChatPanel/LinksPanel placeholders): superseded by the real live room and drifting from it. Hardened the link unfurler against redirect-based SSRF.
- 2026-06-12 (Phase 6) — Tap-Now mechanic interpreted as: opening the sheet freezes a target moment (lag = wall time from open to tap, millisecond-precise); the PRD's ticking reference clock shows live beneath the frozen target. A moving target can't be matched by a viewer who is, by definition, behind it.
- 2026-06-12 (Phase 6) — FR-6.4's "brief toast" replaced by a persistent inline indicator (gold "filling toward your setting" on the bar readout and in the sheet) — strictly more visible than a transient toast while the buffer fills.
- 2026-06-14 (Phase 8) — Radio HLS and the recording share one room-composite egress (two outputs) to halve LiveKit cost. They must share a codec, so the recording file is MP4/AAC (not OGG/Opus, which collides with HLS's AAC); processing transcodes MP4→MP3.
- 2026-06-14 (Phase 8) — The clock Start/Stop controls double as the "segment buttons" (each auto-emits its boundary marker); no separate redundant live transition control is built. Post-session ±2min adjust + recut lives in the downloads panel. The 30s auto/manual merge rule is implemented in `emitMarker` for completeness.
- 2026-06-14 (Phase 8) — Segment derivation drops sub-2s spans and merges adjacent same-label spans, so a prompt Start ET (within the sliver window after Stop 2H) yields exactly six clean segments rather than a spurious tiny post-game.
- 2026-06-14 (Phase 8) — Dropped the `archiver` dependency for a ~40-line dependency-free STORE-method ZIP writer (`buildZipStore`): archiver's CJS export was unresolvable across Next's bundler interop, and audio is already compressed so STORE is correct anyway. Validated with Windows Expand-Archive.
- 2026-06-14 (Phase 8 hardening, post adversarial review — 11 confirmed findings, all fixed):
  - **Privacy:** the byte-identical room mix sat in the PUBLIC radio bucket indefinitely (defeating "recordings private to commentator+admin"). Now `purgeRadio` deletes `radio/{roomId}/*` on End Broadcast (radio is live-only), and `ensureBucket` re-asserts `recordings` private on every start (not just at create).
  - **Marker adjust:** an adjustment could cross a neighbouring boundary and scramble segment labels (e.g. Post-game before Second half), or land past recording end (phantom segment / out-of-range ffmpeg `-to`). The adjust API now clamps each marker strictly between its neighbours and inside the recording span; `deriveSegments` also hard-clamps every boundary to `[0, end]` and re-sorts the close in.
  - **Concurrency/recovery:** `processRecording` now atomically claims the recording (status flip with a stale-reclaim window via `processing_started_at`), so concurrent runs can't corrupt segment rows and a crashed/timed-out run is reclaimable instead of pinned at 'processing' forever; unique per-run temp dir (`mkdtemp`); a "Retry if stuck" affordance in the panel. Both processing paths are async (`triggerProcessing`/after) with `maxDuration=300`; a true 90-min transcode still wants a worker (existing decision-log note).
  - **Robustness:** `waitForEgress` distinguishes a slow finalize from a hard failure (180s, reasoned error); empty detection tightened for the MP4 source; stale OGG comments corrected to MP4.
