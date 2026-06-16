# CLAUDE.md — FanCast

FanCast (working name, rename pending) is a live fan-commentary platform for football. A fan commentator broadcasts live audio for Arsenal matches; listeners watch their own TV/stream and get chat, live stats, a curated links feed, questions, call-ins, and a sync system that aligns commentary to their own feed. Full spec lives in `docs/`.

## Golden rules (never violate)

1. **Audio only, never the broadcast.** The platform must never transmit, embed, proxy, or link-unfurl-into-playback any match video or broadcast audio. This is the legal foundation of the entire product. No exceptions, including "just for testing."
2. **One phase at a time.** Work only on the current phase in `docs/PHASES.md`. Do not build ahead, do not refactor completed phases without being asked. Check boxes as acceptance criteria pass.
3. **iOS Safari is the certification gate** for all audio features. A feature is not done until it works there.
4. **Mobile-first.** Build the stacked mobile layout first, expand to the three-column desktop.
5. **DB is the source of truth, Ably is transport.** Every write goes through an API route that validates, persists to Supabase, then publishes to Ably. Clients must be able to reconstruct room state from the DB after reconnect.
6. **Never tick the clock over the wire.** Clock and room state are event-sourced (`clock_events`); clients render the running clock locally. See `docs/ARCHITECTURE.md`.
7. **Brand strings live in one config.** The product will be renamed. All user-facing brand strings, email sender names, and file-naming templates come from `lib/brand.ts`. Never hardcode "FanCast" in components.

## Stack (decided, do not re-litigate)

Next.js (App Router) + TypeScript strict + Tailwind on Vercel. Supabase (Postgres + Auth + Storage, RLS everywhere). LiveKit Cloud for audio (WebRTC + HLS egress + recording). Ably for chat/control channels. Sportmonks (v3 football) for match data. Stripe for tipping. Resend for email. Full rationale in `docs/ARCHITECTURE.md`.

## Conventions

- App Router with route groups: `(marketing)` for static pages, `(app)` for the product.
- Server components by default; client components only where interactivity demands.
- All Supabase access through `lib/db/` helpers; no inline queries in components.
- API routes in `app/api/`; every route validates input with zod before touching the DB.
- Design tokens are CSS variables defined once (`app/globals.css`) per `docs/DESIGN.md`; Tailwind references the variables. Both themes ship with every component.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on anything that ticks: clock, score, stats, counts.
- Commit per working feature slice with a plain message. No giant commits at phase end.
- Tests: unit-test pure logic (clock derivation, sync offset math, flag weighting, marker merging, segment boundary computation). Don't chase UI coverage in MVP.

## Decision log (defaults the founder can override)

| Decision | Value | Status |
|---|---|---|
| Audio platform | LiveKit (Agora documented fallback) | Final |
| Email provider | Resend | Default |
| One-time tip presets | $3 / $5 / $10 / custom | Default |
| Monthly support tiers | $3 / $5 / $10 | Default |
| Platform fee on tips | 10%, shown transparently in tip sheet | Placeholder, founder to confirm before Phase 9 |
| Segment cutting | Vercel function + ffmpeg-static, MP3 stream-copy; move to small worker only if limits hit | Default |
| Waiting-room audio | Not recorded; recording starts at Start Broadcast | Final |
| Recording rights | Commentator owns 100%, no platform license, no exclusivity | Final (policy) |
| Dump button / broadcast delay for callers | Not built | Final |
| Chat vote arrows | Visible on every message, always | Final |
| `fixtures` table (Sportmonks cache; absent from ARCHITECTURE data model); dev seeds use negative ids, purged on first real sync | Added Phase 2 | Assumed |
| Theme conflict: explicit device choice (localStorage) beats account `theme_pref`; account pref fills in on devices with no choice | Phase 2 | Assumed |
| Fixtures sync trigger: admin-only POST `/api/fixtures/sync`; scheduled trigger deferred to Phase 7 | Phase 2 | Assumed |
| Vote/flag aggregates denormalized onto `chat_messages`/`links` rows, recomputed from vote rows on every write | Phase 3 | Assumed |
| Flag weight "established" = account ≥48h AND standing good; the "no session history" criterion waits for `listener_segments` (Phase 9) | Phase 3 | Assumed |
| Blocklist matches the exact domain and all subdomains | Phase 3 | Assumed |
| Hide log = `hidden_by`/`hidden_at` columns + flag rows; no separate log table | Phase 3 | Assumed |
| PostgREST embeds need explicit FK hints (`profiles!<fk_name>`) since junction tables (votes/flags) make joins ambiguous | Phase 3 | Technical note |
| Link cards are rich previews (wide image, headline, description), overriding the PRD's "compact preview cards" | Founder decision 2026-06-11 | Final |
| Waiting-room countdown targets a commentator-set broadcast start time (`rooms.broadcast_start`), not kickoff; no time set = calm "show starts soon" card | Founder decision 2026-06-11 | Final |
| Commentator can open chat and/or links to listeners during waiting (`rooms.chat_open`/`links_open` toggles), relaxing FR-3.2's commentator-only waiting chat | Founder decision 2026-06-11 | Final |
| Stats panel shows zeros (possession 50/50) until live Sportmonks data arrives (Phase 7) | Founder decision 2026-06-11 | Final |
| Ending a call is neutral (no profile/eligibility effect), replacing FR-4.4's "never removed from air" gate; problem callers handled by commentator-only `caller_flags` (informational, shown on request cards) + reversible `call_in_blocks` (bars call-ins only) | Founder decision 2026-06-11 | Final |
| Match-data provider: **Sportmonks** (v3 football) — replaces API-Football after account issues. Env `SPORTMONKS_API_TOKEN`/`SPORTMONKS_BASE`; Arsenal team id 19, EPL league id 8 (in `lib/config.ts`); sync fetches `/fixtures/between/{start}/{end}/{teamId}`. Plan must cover the English Premier League. | Founder decision 2026-06-16 | Final |
| Match-stats proxy: public `GET /api/stats/[fixtureId]` (reading is open) with a hardcoded Sportmonks include and a `globalThis` TTL(10s) cache + in-flight coalescing + last-good fallback; seed/invalid id (≤0) returns the zeros contract with no upstream call | Phase 7 | Assumed |
| `stats_tab` is a transient control-channel hint (commentator→listeners via `POST /api/stats-tab`), not persisted (no DB row); recovered on reconnect via the control channel's rewind window; a listener's local tab tap overrides until the next push | Phase 7 | Assumed |

## Where things are specified

- Requirements and acceptance criteria: `docs/PRD.md`
- Data model, channels, routes, audio pipeline: `docs/ARCHITECTURE.md`
- Tokens, components, clock/state rules: `docs/DESIGN.md`
- Build order and current status: `docs/PHASES.md`
- Content for /guidelines, /terms, /privacy, consent copy: `docs/LEGAL_PAGES.md`

## When the spec is silent

Make the smallest reasonable choice, note it in the Decision log above with status "Assumed", and continue. Ask the founder only when a choice is user-visible and hard to reverse (payments, data retention, anything touching the golden rules).
