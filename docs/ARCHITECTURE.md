# Architecture

## Stack and rationale

| Layer | Choice | Why |
|---|---|---|
| Frontend/hosting | Next.js (App Router) + TS strict + Tailwind, Vercel | Standard high-velocity solo stack; PWA-capable |
| Audio | LiveKit Cloud | One platform for WebRTC broadcast, call-in permission elevation, room-composite recording, and HLS egress; ~2.5x cheaper per minute than Agora at scale; Apache-licensed server = self-host escape hatch. Agora is the documented fallback if iOS Safari surprises us in Phase 5 |
| Realtime messaging | Ably | Channel semantics, presence (watching count), token capabilities for the private commentator channel |
| DB/auth/storage | Supabase | Postgres + RLS, magic-link/OAuth, recording storage (S3-compatible for egress) |
| Match data | Sportmonks (v3 football; plan covering the EPL) | Switched from API-Football 2026-06-16 after account issues; plan must include the English Premier League (the free plan does not) |
| Payments | Stripe | Checkout (one-time) + Billing (recurring); Connect deferred |
| Email | Resend | Going-live notifications |
| Segment cutting | ffmpeg-static in a Vercel function | MP3 stream-copy cutting is I/O-bound and fast; move to a small worker only if function limits are hit |

Tier requirements: **LiveKit Ship ($50/mo) before any real session** (free tier = 5,000 participant-minutes hard cap; one 50-listener match ≈ 7,500). Vercel Pro when tipping ships (Hobby prohibits commercial use).

## Data model (Supabase, RLS everywhere)

| Table | Key fields |
|---|---|
| profiles | user_id, username, role, avatar_url, standing, theme_pref, created_at |
| follows | follower_id, commentator_id, created_at |
| rooms | id, fixture_id, commentator_id, state, scheduled_kickoff, opened_at, started_at, ended_at, livekit_room |
| clock_events | room_id, action (start1h/stop1h/start2h/stop2h/adjust), server_ts, offset_seconds |
| broadcast_markers | room_id, label, server_ts, source (auto/manual), adjusted_ts |
| chat_messages | room_id, user_id, body, created_at, hidden_by (null/flags/commentator/admin), is_waiting_room |
| message_votes | message_id, user_id, value (+1/-1), unique pair |
| message_flags | message_id, user_id, weight, created_at |
| links | room_id, user_id, url, og_title, og_description, og_image, domain, hidden |
| link_votes | link_id, user_id, value |
| questions | room_id, user_id, body, status (new/acknowledged/dismissed), created_at |
| talk_requests | room_id, user_id, topic, status (pending/accepted/dismissed/completed), consent_at |
| speaker_events | room_id, user_id, action (elevated/left_air/removed), server_ts |
| slider_votes | room_id, user_id, value 0-100, updated_at |
| predictions | room_id, user_id, home_score, away_score |
| polls / poll_votes | room_id, question, options[] / poll_id, user_id, option_idx |
| player_ratings | room_id, user_id, player_id, rating 1-10 |
| listener_segments | room_id, user_id, joined_at, left_at, mode (webrtc/hls) |
| recordings | room_id, storage_path, started_at, duration, status |
| recording_segments | recording_id, label, start_offset, end_offset, storage_path, size |
| tips | user_id, commentator_id, room_id?, amount, currency, stripe_ref, kind (oneoff/recurring) |
| subscriptions | user_id, commentator_id, stripe_subscription_id, tier, status |
| blocklist_domains | domain, reason, added_by |
| bans | user_id, device_hash, reason, expires_at? |

RLS notes: `questions` and `talk_requests` readable only by author and the room's commentator (+admin). `message_flags` write-only for listeners, readable by commentator/admin. `recordings`/`recording_segments` readable only by commentator/admin; downloads via signed URLs.

## Realtime channels (Ably, per room)

| Channel | Carries | Access |
|---|---|---|
| `room:{id}:chat` | messages, votes, flags; presence attached (watching count) | all participants |
| `room:{id}:links` | new links, vote updates, hides | all participants |
| `room:{id}:control` | room state changes, clock events, markers, tab pushes, slider aggregate, technical-difficulties signal | all participants (publish: server only) |
| `room:{id}:private` | questions, talk-request status | subscribe: commentator capability token only; listeners publish via API routes |

Rules: clients never publish directly to `control`. The clock is event-sourced: broadcast `{action, server_ts, offset}`; clients compute display time locally and resync on each event (one message per half, not per second). On reconnect: rehydrate from DB, then attach with channel history replay.

## API surface (Next.js routes, zod-validated)

`/api/rooms` (open-waiting, start, end, state) · `/api/clock` · `/api/markers` (+post-session adjust) · `/api/chat` (send, vote, flag, hide) · `/api/links` (submit→unfurl, vote) · `/api/questions` (submit, ack, dismiss) · `/api/talk` (request, accept, dismiss, leave) · `/api/widgets` (predict, poll, vote, rate) · `/api/livekit/token` (role-scoped grants) · `/api/stripe` (checkout, portal, webhook) · `/api/stats` (API-Football proxy with cache; clients never hit the vendor directly) · `/api/recordings` (status, signed URLs, recut).

## Audio pipeline

- One LiveKit room per match room. Commentator publishes processed track: mic → Web Audio delay node (self-delay 1-5s, commentator setting) → publish.
- Guests publish on permission elevation; Leave Air revokes instantly.
- Listener watch-along path: WebRTC subscribe → 90s Web Audio ring buffer → playback at offset (see PRD FR-6). ~17MB memory at full depth.
- Radio path: room-composite **HLS egress** runs continuously while live; plain `<audio>` playback.
- Recording: room-composite egress to MP3 in Supabase storage (S3-compatible credentials), Start→End Broadcast, survives commentator disconnects.
- Segment job on `wrapped`: ffmpeg `-c copy` cuts at marker offsets (marker server_ts − recording start ts); writes per-segment MP3s + zip; signed URLs.

## Scaling path

Nothing changes until ~1,000 concurrent per room (LiveKit SFU broadcast). Beyond: WebRTC for the interactive minority, HLS for the listening majority — an extension of radio mode, not a rewrite. At 500 concurrent × 4 matches/mo, LiveKit ≈ $120/mo.

## Cost summary

| Stage | Monthly |
|---|---|
| Build (pre-launch) | $0-20 |
| Testing (10-50 listeners) | $70-110 (LiveKit Ship 50 + Sportmonks plan + Vercel Pro 20 + misc) |
| 500 concurrent, 4 matches/mo | $250-450 |
