# Build Phases (living checklist)

Rules: one phase at a time, in order. A phase is complete when every box is checked and its acceptance test passes. Check boxes in this file as you go; note deviations inline. iOS Safari gates all audio items.

**Current phase: 1**

## Phase 1: Foundation + layout + theming (days 1-3)
- [ ] Next.js + TS strict + Tailwind scaffold; deploy pipeline to Vercel
- [ ] `lib/brand.ts` config (name, file-naming template, email sender)
- [ ] Token system per docs/DESIGN.md as CSS variables; dark + light themes; header toggle, system default, no-flash load
- [ ] Mobile stacked layout shell; desktop three-column shell (stats 25 / chat 50 / links 25)
- [ ] Persistent audio bar shell (listener variant, UI only)
- [ ] Home page shell with placeholder fixture cards
- **Test:** deployed site renders both themes correctly, responsive at 360px/768px/1280px.

## Phase 2: Auth + roles + follows + home schedule (days 3-6)
- [ ] Supabase auth (magic link + one OAuth provider); username flow (unique, 30-day change lock)
- [ ] profiles/roles; commentator + admin manual grants
- [ ] Follow system; counts on profile and room header
- [ ] API-Football fixtures sync; home schedule with localized kickoff times; enterability gating by room state
- [ ] Anonymous read access pattern (inputs replaced by join prompt)
- **Test:** sign up, follow, see schedule; scheduled room not enterable; counts increment.

## Phase 3: Chat + links + moderation (days 6-10)
- [ ] Ably setup with token auth; chat channel with presence (watching count) and history replay
- [ ] Chat send + votes on every message (always visible) + rate limit
- [ ] Weighted flag-to-hide (0.5/1.0 weights, ≥3.0 hides, 10-flag budget, hide log)
- [ ] Commentator styling variant + instant-hide; admin ban/purge basics
- [ ] Links feed: submit → server-side OG unfurl → card; votes; 2:1+5 ratio hiding; domain blocklist
- **Test:** two-browser session covering all of it; blocklisted domain rejected.

## Phase 4: Room lifecycle + waiting room + interaction surfaces (days 10-14)
- [ ] Room state machine + control channel; DB as source of truth, replay on reconnect
- [ ] Waiting room: Open Waiting Room, countdown, commentator-only chat, read-only listeners
- [ ] Start Broadcast unlock (all inputs, all clients, <1s, no reload)
- [ ] Questions tab (private channel, badge, newest-first, ack/dismiss)
- [ ] Request to Talk flow incl. first-use consent checkbox (copy from docs/LEGAL_PAGES.md); commentator bar cards with Accept/Dismiss
- [ ] Preference slider + public aggregate meter
- [ ] Collapsible side panels (commentator); Radio-Only toggle shell
- **Test:** full lifecycle walkthrough with two roles in two browsers.

## Phase 5: Audio + speakers + background listening (days 14-20)
- [ ] LiveKit room per match; token route with role grants; commentator publish (mono), listeners subscribe
- [ ] Commentator self-delay (Web Audio delay node, 1-5s setting)
- [ ] Call-in: permission elevation on Accept; ON AIR bar; Leave Air; speaker chips with X; eligibility gates
- [ ] Technical difficulties card (disconnect or 10s silent-while-unmuted; clears <2s on reconnect; 15-min soft banner)
- [ ] MediaSession (lock-screen controls/metadata); PWA manifest + service worker (push-ready) + install prompt
- [ ] HLS egress while live; radio mode playing HLS in `<audio>`
- [ ] iOS Safari + Android Chrome locked-screen matrix: 15-min runs on both paths; record results in this file
- **Test:** laptop→phone broadcast; call-in cycle; kill commentator network (card <5s, chat alive, auto-resume); 15-min locked-screen radio run on iOS.

## Phase 6: Sync + clock/state component (days 20-23)
- [ ] 90s Web Audio ring buffer; offset playback; depth-aware UI
- [ ] Sync sheet: ticking reference clock, tap-Now calibration, live-edge reset, ±0.5s steppers, numeric offset display, per-session persistence
- [ ] Clock/state unit per FR-7 (period label + clock during play; state word otherwise; never both); ±1s adjustments; event-sourced derivation; reconnect-safe
- **Test:** align to a deliberately 45s-delayed feed in one calibration pass (≤1s error); full simulated match clock cycle.

## Phase 7: Stats + lineups + tab control (days 22-26)
- [ ] API-Football proxy route with cache; polling cadence 60s live / 15s around kickoff+goals
- [ ] Compact stat bars, events timeline, Home/Away XI tabs with formations and subs
- [ ] Commentator push-to-default tab via control channel; listener override
- [ ] Radio-mode enlarged stats variant
- **Test:** during any live fixture, stats render correctly in both themes and radio mode; tab push <1s.

## Phase 8: Recording + markers + downloads (days 26-29)
- [ ] Room-composite egress MP3 → Supabase storage, Start→End Broadcast, disconnect-proof
- [ ] Segment button (next-transition list); auto-markers from clock events; 30s merge rule
- [ ] ffmpeg cut job on wrapped (stream-copy at marker offsets); per-segment files + zip; signed URLs
- [ ] Downloads panel: processing status, file list with names/durations/sizes, ±2 min marker adjust + recut, rights notice + courtesy line
- **Test:** simulated session with two call-ins and all markers → full file + six correct segments including guest audio; adjust recuts.

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
