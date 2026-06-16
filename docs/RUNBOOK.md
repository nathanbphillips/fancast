# Live Session Runbook (commentator + operator)

Operational guide for running a broadcast — pre-flight checks, the live flow, and what to do when something breaks. Pair this with `docs/PHASES.md` (build status) and the golden rules in `CLAUDE.md`.

> **Golden rule, always:** audio only. Never share, embed, link, or describe-to-find a video/broadcast-audio stream in chat or links. The links blocklist + moderation enforce "no piracy / no unsafe downloads" — but the commentator sets the tone.

---

## Pre-flight (do this ~30 min before kickoff)

- [ ] **Production wiring** — run `npm run smoke:prod`. All checks must pass (app serving; Ably, LiveKit, Supabase, anon key wired; service key not leaked). If a LiveKit check is skipped, open a waiting room first (below) and re-run.
- [ ] **Signed in as the commentator account** on the live site (the account must have the `commentator` role — `npm run grant-role -- <username> commentator` if not).
- [ ] **Browser + mic** — use a Chromium browser on the broadcasting machine; grant mic permission and confirm the right input device. (Listeners can be on anything; iOS Safari is the cert target.)
- [ ] **Your feed** — have your TV/stream up and know its **delay** vs. live (you'll calibrate sync against it).
- [ ] **Storage/recording** — recording + radio need the Supabase S3 env in Vercel. `npm run smoke:prod` covers LiveKit/token wiring; a quick `tsx --env-file=.env.local scripts/s3-check.ts` confirms storage credentials end to end.
- [ ] **Stats** — live stats/lineups need an active API-Football key. If it's not active, the stats panel shows zeros/placeholder; the broadcast still runs fully. (Tracked in PHASES.md Phase 7.)
- [ ] **Dashboards open** to watch during the show: Vercel (logs), LiveKit Cloud (room/egress), Ably (connections), Supabase (DB).

## Going live — the flow

1. **Open Waiting Room** — home → the fixture → *Open Waiting Room*. Room enters `waiting`. Listeners can land here and see a countdown.
2. **Set the broadcast start time** in the commentator bar (this drives the listeners' countdown — it counts to *your* start, not kickoff). No time set = a calm "show starts soon" card. You can optionally **open chat and/or links early** with the bar toggles while still in waiting.
3. **Start Broadcast** — requires a **live mic** (FR-3.3). This:
   - unlocks all inputs for every client in <1s, no reload;
   - starts the **recording** (private MP4 → processed to MP3 on End) and the **radio HLS** stream;
   - opens the outermost segment span.
4. **Run the clock** as the match plays — the controls double as segment markers:
   `Start 1H` → `Stop 1H` (→ halftime) → `Start 2H` → `Stop 2H` (→ postgame) → optional `Start ET` / `Stop ET`. Use the **±1s adjust** on the bar to nudge alignment. Clients render the running clock locally; you only emit transitions.
5. **Questions** (Questions tab, private to you): newest-first, **ack** or **dismiss**.
6. **Call-ins**:
   - Accept/dismiss request cards. **Max 2 guests on air** at once (the 3rd accept is refused).
   - A guest goes live on accept; end a call via the **X** on their speaker chip, or they tap **Leave Air**. Ending a call is **neutral** — no effect on the caller's standing.
   - Problem callers: **flag** the caller (informational note on future cards) and/or apply a **reversible call-in block** (bars their call-ins only). Both are commentator-only.
7. **Self-delay** (commentator bar) — route your mic through the delay node (Off, or 1–5s) if you're watching a delayed feed.
8. **End Broadcast** — room → `wrapped`. Recording processing kicks off asynchronously; the **Downloads panel** shows status → full MP3 + per-segment MP3s + a zip, with ±2 min marker adjust + recut. Radio HLS is **purged** on End (radio is live-only); the private recording is the durable copy.

## If something breaks

- **Your network drops mid-broadcast** → listeners see a "technical difficulties" card within ~5s, **chat stays alive**, and audio **auto-resumes** on reconnect (a soft banner after 15 min). Just get back online; don't End Broadcast.
- **A listener's clock/score looks stuck or wrong** → until the reconnect-rehydrate fix (audit **M-4**) ships, a listener whose connection blipped during a transition may need to **reload** to re-sync. Tell them to refresh. (M-4 is the next engineering item.)
- **Audio won't publish / no mic** → Start Broadcast is blocked without a live mic by design. Re-check browser mic permission and the selected input; reload the commentator page if needed.
- **Recording stuck "processing"** → the Downloads panel has a *Retry if stuck* affordance; a crashed run is reclaimable. A very long (90-min) transcode can exceed serverless limits — fine for test-length sessions (see decision log).
- **Radio (HLS) silent on a listener device** → it's the fallback path; confirm they're on the radio toggle. iOS/Android locked-screen behavior is the device-matrix gate (PHASES.md Phase 5).
- **Banned/blocked user causing trouble** → admin ban (chat) and call-in block (audio) are both reversible; a banned user is refused both chat writes and LiveKit tokens.

## After the session

- Download the full MP3 + segments from the Downloads panel (you own the recording 100%, no platform license).
- The public radio copy is already gone (purged on End). Nothing byte-identical to the broadcast remains public.
- Note anything that broke in `docs/PHASES.md` (device-matrix results) or raise it for a fix.
