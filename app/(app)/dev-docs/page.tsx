import type { Metadata } from "next";
import type { ReactNode } from "react";
import { brand } from "@/lib/brand";

/**
 * Developer handoff overview at /dev-docs. A single, comprehensive, accurate
 * map of the build for an incoming developer (telemetry + features). Reflects
 * what is ACTUALLY built, not the aspirational spec in docs/ARCHITECTURE.md.
 *
 * Visibility: public but noindex (an unlisted handoff URL — no account needed).
 * To restrict it to admins instead, gate it like app/(app)/admin/page.tsx
 * (getCurrentUserAndProfile + isAdmin + redirect).
 */
export const metadata: Metadata = {
  title: "Developer overview",
  robots: { index: false, follow: false },
};

// ---- small presentational helpers (server component, no client JS) ----

function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-raised px-1 py-0.5 font-mono text-[0.85em] text-primary">{children}</code>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-8">
      <h2 className="text-xl font-bold tracking-tight text-primary">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-secondary">{children}</div>
    </section>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-primary">{children}</h3>;
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-surface">
            {head.map((h) => (
              <th key={h} className="border-b border-line px-3 py-2 font-semibold text-primary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((cell, j) => (
                <td key={j} className="border-b border-line px-3 py-2 text-secondary">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="ml-5 list-disc space-y-1.5">{children}</ul>;
}

const TOC: { id: string; label: string }[] = [
  { id: "tldr", label: "TL;DR" },
  { id: "golden", label: "Non-negotiables" },
  { id: "stack", label: "Stack" },
  { id: "model", label: "Architecture model" },
  { id: "repo", label: "Repo layout" },
  { id: "data", label: "Data model" },
  { id: "realtime", label: "Realtime channels" },
  { id: "api", label: "API routes" },
  { id: "audio", label: "Audio pipeline" },
  { id: "matchdata", label: "Match-data pipeline" },
  { id: "security", label: "Auth & security" },
  { id: "features", label: "Feature tour" },
  { id: "status", label: "Build status" },
  { id: "telemetry", label: "Telemetry (read this)" },
  { id: "env", label: "Env & deployment" },
  { id: "conventions", label: "Conventions & gotchas" },
  { id: "gaps", label: "Known gaps / TODO" },
  { id: "dig", label: "Where to dig in" },
];

export default function DevDocsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Internal handoff doc</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-primary">
          {brand.name} — developer overview
        </h1>
        <p className="mt-2 max-w-3xl text-[15px] text-secondary">
          A live fan-commentary platform for football (working name; rename pending). A commentator
          broadcasts live audio for a match; listeners watch their own stream and get a synced clock,
          live stats, a threaded chat/links stream, questions, call-ins, and recordings. This page is a
          self-contained map of how it&apos;s built — written for an incoming developer reviewing the
          codebase and adding telemetry + features. It reflects what is{" "}
          <em>actually built</em> (the spec in <C>docs/</C> drifts ahead of the code in places — those
          gaps are called out).
        </p>
        <p className="mt-2 text-sm text-secondary">
          Production: <C>https://fancast-26.vercel.app</C> · Repo: <C>nathanbphillips/fancast</C> ·
          Stack: Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind v4.
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
        {/* sticky table of contents */}
        <nav className="mb-8 lg:sticky lg:top-6 lg:mb-0 lg:self-start" aria-label="Contents">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-secondary">On this page</p>
          <ul className="space-y-1.5 text-[13px]">
            {TOC.map((t) => (
              <li key={t.id}>
                <a className="text-secondary hover:text-primary hover:underline" href={`#${t.id}`}>
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 space-y-8">
          <Section id="tldr" title="TL;DR">
            <UL>
              <li>
                <b className="text-primary">Mental model:</b> one commentator broadcasts audio per
                &quot;room&quot; (a match). Listeners watch their own TV/stream and sync our commentary to
                it. The product is <b className="text-primary">audio-only</b> — it never touches match
                video (legal foundation; see Non-negotiables).
              </li>
              <li>
                <b className="text-primary">Architecture in one line:</b> the database is the source of
                truth, Ably is the transport. Every write goes through a zod-validated Next API route →
                Supabase → then publishes to Ably. Clients reconstruct full room state from the DB on
                reconnect.
              </li>
              <li>
                <b className="text-primary">Status:</b> Phases 1–11 are code-complete and verified;
                pre-launch. Deferred: Stripe tipping, Resend email notifications, the iOS-Safari audio
                certification pass, and a final mobile/Lighthouse polish.
              </li>
              <li>
                <b className="text-primary">Telemetry today:</b> essentially none beyond{" "}
                <C>listener_segments</C> (audio-session rows) + a SQL query pack. No error tracking, APM,
                product analytics, or web-vitals reporting yet — that&apos;s the greenfield. See the{" "}
                <a className="text-gold hover:underline" href="#telemetry">
                  Telemetry section
                </a>
                .
              </li>
            </UL>
          </Section>

          <Section id="golden" title="The non-negotiables (read before touching anything)">
            <p>
              These are invariants, not preferences. They live in <C>CLAUDE.md</C> and are enforced
              throughout the code.
            </p>
            <ol className="ml-5 list-decimal space-y-1.5">
              <li>
                <b className="text-primary">Audio only, never the broadcast.</b> The platform must never
                transmit, embed, proxy, or unfurl-into-playback match video or broadcast audio. This is
                the legal basis of the product. (It&apos;s why link unfurling is SSRF-hardened and why
                there&apos;s a domain blocklist.)
              </li>
              <li>
                <b className="text-primary">DB is the source of truth; Ably is transport.</b> No client
                ever publishes to the control channel. Writes go API → Supabase → Ably.
              </li>
              <li>
                <b className="text-primary">Never tick the clock over the wire.</b> Room clock/state is
                event-sourced in <C>clock_events</C>; clients derive the running clock locally (one
                message per transition, not per second). See <C>lib/clock.ts</C>.
              </li>
              <li>
                <b className="text-primary">iOS Safari is the certification gate</b> for every audio
                feature. A feature isn&apos;t &quot;done&quot; for audio until it works there.
              </li>
              <li>
                <b className="text-primary">Brand strings live in one config.</b> The product will be
                renamed — all user-facing brand strings come from <C>lib/brand.ts</C>. Never hardcode the
                name in a component.
              </li>
              <li>
                <b className="text-primary">RLS everywhere.</b> Every Supabase table has row-level
                security; the anon key can read only what&apos;s public. Service-role writes happen only
                server-side in API routes after an explicit auth check.
              </li>
            </ol>
          </Section>

          <Section id="stack" title="Stack">
            <Table
              head={["Layer", "Choice", "Notes"]}
              rows={[
                ["Frontend / host", "Next.js 15 App Router, React 19, TS strict, Tailwind v4, Vercel", "Server components by default; client components only where interactivity demands. PWA-capable (manifest + service worker)."],
                ["DB / auth / storage", "Supabase (Postgres + Auth + Storage)", "RLS everywhere. Magic-link + OAuth. Recording storage is S3-compatible (for LiveKit egress)."],
                ["Realtime", "Ably", "Per-room channels, presence (watching count), capability tokens for the private commentator channel."],
                ["Audio", "LiveKit Cloud", "WebRTC broadcast, call-in permission elevation, room-composite recording, HLS egress. @livekit/rtc-node is used in test scripts only."],
                ["Match data", "Sportmonks v3 (football)", "Plan covers Premier League / FA Cup / Carabao Cup / 2. Bundesliga ONLY. Arsenal=team 19, EPL=league 8 (lib/config.ts)."],
                ["Player links", "Fotmob (unofficial suggest endpoint)", "Link-out only, never embedded. Resolved server-side + cached."],
                ["Media processing", "ffmpeg-static in a Vercel function", "MP3 stream-copy segment cutting on a wrapped recording."],
                ["Validation", "zod v4", "Every API route validates input before touching the DB."],
                ["Payments / email", "Stripe / Resend", "DEFERRED — not yet built (no Stripe dep, no /api/stripe). Tipping + going-live emails are Phase 9 remainder."],
              ]}
            />
          </Section>

          <Section id="model" title="Architecture model">
            <p>
              The whole system is one idea applied consistently: <b className="text-primary">DB is
              truth, Ably is transport, the clock is derived.</b>
            </p>
            <H3>The write path (memorize this)</H3>
            <p>
              Client action → <C>POST /api/...</C> (zod-validate) → persist to Supabase (service role,
              after an auth check) → <C>publish()</C> to the relevant Ably channel. The client&apos;s own
              optimistic update is confirmed by the echoed Ably event. Listeners apply the event live.
            </p>
            <H3>Reconnect / recovery</H3>
            <p>
              Brief Ably blips are covered by channel rewind (history replay). Longer drops are covered by{" "}
              <C>GET /api/rooms/[id]/snapshot</C> — a read-only reconcilable snapshot that rebuilds room
              state from the DB (state, clock events, chat threads, links, widgets, and the commentator&apos;s
              stat overrides). This is golden rule #2 made concrete; any new realtime state must also be in
              the snapshot.
            </p>
            <H3>The clock</H3>
            <p>
              Never sent as a ticking value. <C>clock_events</C> stores{" "}
              <C>{"{ action, server_ts, offset_seconds }"}</C> (start1h / halftime / start2h / fulltime /
              start_et / end_et / ±1s adjust). The client derives the running clock from those events plus
              wall-clock (<C>lib/clock.ts</C>, unit-tested). Score tracks the live provider; the clock does
              not.
            </p>
          </Section>

          <Section id="repo" title="Repo layout">
            <Table
              head={["Path", "What's there"]}
              rows={[
                [<C key="a">app/(app)/</C>, "The product. Pages: / (home schedule), /room/[id], /admin, /signin, /welcome, /u/[username], /guidelines, /terms, /privacy, and this /dev-docs. Has the app layout (header, footer, ToastProvider)."],
                [<C key="b">app/api/</C>, "All server routes (zod-validated). Grouped below."],
                [<C key="c">lib/</C>, "Pure logic + integrations: clock, markers, stats (Sportmonks normalize), history, statsCache, statOverrides, fotmob, fixtures, adminFixtures, ably, livekit, egress, recording, unfurl, redirect, ratelimit, standing, predictions/polls/ratings, roles, api (auth helpers), config, brand, theme. lib/db/ = Supabase client/server/types + thread loader. lib/hooks/ = useFixtureStats, useMatchHistory, useFotmobLinks."],
                [<C key="d">components/</C>, "UI. components/room/ (RealtimeRoom orchestrator, CommentatorBar, ClockControls, audio/, widgets), components/stats/ (StatsPanel + bars/timeline/lineups/pitch/info/history/editor), components/admin/, plus shared (MatchHeader, ClockState, Toast, Legal, SiteFooter…)."],
                [<C key="e">db/migrations/</C>, "Forward-only SQL migrations 0001–0023 (npm run migrate; tracked in public.schema_migrations). DB is kept AHEAD of code (back-compatible)."],
                [<C key="f">scripts/</C>, "tsx scripts: migrate, grant-role, metrics, and ~20 phase smoke / unit-ish tests (see package.json)."],
                [<C key="g">docs/</C>, "The spec: ARCHITECTURE, PRD, DESIGN, PHASES (living status), METRICS, RUNBOOK, LEGAL_PAGES, AUDIT*. CLAUDE.md (repo root) is the agent/dev brief + decision log."],
              ]}
            />
          </Section>

          <Section id="data" title="Data model (Supabase, RLS everywhere)">
            <p>
              ~30 tables across migrations 0001–0023. The ones you&apos;ll touch most:
            </p>
            <Table
              head={["Table", "Purpose / key fields"]}
              rows={[
                ["profiles", "user_id, username, role (listener/commentator/admin), standing, theme_pref. Establishment for vote/flag weighting = good standing + account ≥48h."],
                ["follows", "follower_id → commentator_id."],
                ["fixtures", "Match cache. id (PK), sportmonks_fixture_id (real upstream id; null until matched), source ('sportmonks'|'admin'), home/away team + ids, kickoff_utc, competition. Admin-created games use a synthetic epoch-ms PK."],
                ["rooms", "id, fixture_id, commentator_id, state (scheduled/waiting/pregame/live/postgame/wrapped…), scheduled_kickoff, broadcast_start, chat_open, links_open, hls_url, livekit_room."],
                ["clock_events", "Event-sourced clock (action, server_ts, offset_seconds). Never a ticking value."],
                ["chat_messages", "Threaded: parent_id / root_id / depth (migration 0018, BEFORE-INSERT trigger). hidden_by, score (weighted), created_at. Replies are just chat_messages rows on the same channel."],
                ["message_votes / message_flags", "Per-user votes (±1, weighted) + flags (weight, 10/match budget, ≥3.0 weighted hides)."],
                ["links / link_votes", "Submitted links (server-side OG unfurl), hidden flag (RLS-redacted like chat, migration 0017)."],
                ["questions / talk_requests / speaker_events", "Private commentator inbox + call-in lifecycle + on-air audit."],
                ["slider_votes / predictions / polls+poll_votes / player_ratings", "The in-stream widgets (migration 0015). Owner-only RLS; aggregates published on the control channel."],
                ["listener_segments", "Audio sessions: room_id, user_id (null=anon), mode (live/radio), started_at, last_seen_at, ended_at. The ONLY analytics today (migration 0016)."],
                ["recordings / recording_segments", "Egress MP3 + per-segment cuts. Commentator/admin-only; downloads via signed URLs."],
                ["player_fotmob", "Cache of Sportmonks player id → Fotmob profile URL (migration 0021)."],
                ["fixture_stats_cache", "Daily-warmed snapshot of a fixture's match data (migration 0022) — cold-start/outage fallback for the stats proxy."],
                ["room_stat_overrides", "Commentator corrections to the Info + Line-ups panels (migration 0023), merged onto Sportmonks data client-side."],
                ["blocklist_domains / bans", "Moderation: link-domain blocklist + user/device bans."],
              ]}
            />
            <p className="text-[13px]">
              RLS highlights: <C>questions</C>/<C>talk_requests</C> readable only by author + the room
              commentator/admin; <C>message_flags</C> write-only for listeners; hidden chat/link bodies
              redacted from anon; <C>recordings</C> commentator/admin-only. Note: <C>tips</C>/
              <C>subscriptions</C> appear in the spec but are not built (tipping deferred).
            </p>
          </Section>

          <Section id="realtime" title="Realtime channels (Ably, per room)">
            <Table
              head={["Channel", "Carries", "Publish"]}
              rows={[
                [<C key="a">room:{"{id}"}:chat</C>, "Messages + replies, votes, flags, hides; presence = watching count.", "Server only (API routes)"],
                [<C key="b">room:{"{id}"}:links</C>, "New links, vote updates, hides.", "Server only"],
                [<C key="c">room:{"{id}"}:control</C>, "Room state, clock events, markers, stats-tab push, widget aggregates, stat_overrides, broadcast_start, radio, features.", "Server only"],
                [<C key="d">room:{"{id}"}:private</C>, "Questions + talk-request status.", "Subscribe via commentator capability token; listeners write via API."],
                [<C key="e">room:{"{id}"}:user:{"{uid}"}</C>, "Per-viewer signals (e.g. talk-request resolution).", "Server only"],
              ]}
            />
            <p>
              Client wiring lives in <C>components/room/RealtimeRoom.tsx</C> (the big orchestrator — every
              subscription, the reconnect rehydrate, and all room state). Server publish helper is{" "}
              <C>lib/ably.ts</C> (<C>channels</C> + <C>publish</C>). Tokens: <C>GET /api/ably/token</C>.
            </p>
          </Section>

          <Section id="api" title="API routes (all zod-validated)">
            <p>Every route validates input before touching the DB. Grouped by area:</p>
            <UL>
              <li>
                <b className="text-primary">Room lifecycle:</b> <C>/api/rooms</C> (open/start/end/state),{" "}
                <C>/api/clock</C>, <C>/api/rooms/[id]/snapshot</C> (reconnect), <C>/api/listen</C>{" "}
                (audio-session start/heartbeat/stop).
              </li>
              <li>
                <b className="text-primary">Stream:</b> <C>/api/chat</C> (+ <C>/hide</C>, <C>/flag</C>,{" "}
                <C>/vote</C>), <C>/api/links</C> (+ <C>/vote</C>) — submit does server-side OG unfurl.
              </li>
              <li>
                <b className="text-primary">Interaction:</b> <C>/api/questions</C>, <C>/api/talk</C> (+{" "}
                <C>/leave</C>), <C>/api/slider</C>, <C>/api/predictions</C>, <C>/api/polls</C>,{" "}
                <C>/api/ratings</C>, <C>/api/callers</C>, <C>/api/follow</C>.
              </li>
              <li>
                <b className="text-primary">Audio:</b> <C>/api/livekit/token</C> (role-scoped grants),{" "}
                <C>/api/recordings</C> (status, signed URLs, recut).
              </li>
              <li>
                <b className="text-primary">Match data:</b> <C>/api/stats/[fixtureId]</C> (Sportmonks
                proxy, 10s cache + coalescing + last-good), <C>/api/history/[fixtureId]</C> (standings/form),{" "}
                <C>/api/stats-tab</C> (commentator tab push), <C>/api/rooms/[id]/overrides</C> (commentator
                Info/lineup edits), <C>/api/fotmob/resolve</C> (player links), <C>/api/fixtures/sync</C>.
              </li>
              <li>
                <b className="text-primary">Admin / cron:</b> <C>/api/admin/rooms</C> (create a room for any
                game), <C>/api/admin/match-fixtures</C> (daily matcher + cache-warm; GET = Vercel cron with{" "}
                <C>CRON_SECRET</C>), <C>/api/admin/ban</C>, <C>/api/admin/purge</C>,{" "}
                <C>/api/admin/blocklist</C>.
              </li>
              <li>
                <b className="text-primary">Infra:</b> <C>/api/ably/token</C>, <C>/api/profile</C>,{" "}
                <C>/api/health</C>.
              </li>
            </UL>
            <p className="text-[13px]">
              Auth helpers in <C>lib/api.ts</C> (<C>requireParticipant</C>) + <C>lib/roles.ts</C> (
              <C>isAdmin</C>). Commentator-gated routes check{" "}
              <C>room.commentator_id === caller.userId || isAdmin</C>.
            </p>
          </Section>

          <Section id="audio" title="Audio pipeline (LiveKit)">
            <UL>
              <li>
                <b className="text-primary">Broadcast:</b> one LiveKit room per match room. The commentator
                publishes mic → Web Audio delay node (self-delay 0–5s) → LiveKit. Going on air requires a
                live mic.
              </li>
              <li>
                <b className="text-primary">Call-ins:</b> permission elevation on Accept; an ON AIR bar;
                Leave Air revokes instantly; 2-guest cap. Ending a call is neutral; problem callers are
                handled by commentator-only flags + reversible call-in blocks.
              </li>
              <li>
                <b className="text-primary">Watch-along sync:</b> listeners subscribe via WebRTC into a 90s
                Web Audio ring buffer (AudioWorklet) and play back at a chosen offset, so they can align our
                commentary to their own (often delayed) TV feed. The sync sheet has tap-to-calibrate, ±0.5s
                steppers, and per-session persistence. Volume runs through a Web Audio gain node (the only
                volume iOS Safari honours on the live path).
              </li>
              <li>
                <b className="text-primary">Radio mode:</b> a continuous room-composite HLS egress, played
                in a plain <C>&lt;audio&gt;</C> — background/lock-screen listening, no sync.
              </li>
              <li>
                <b className="text-primary">Recording:</b> the same room-composite egress also writes MP4/AAC
                to Supabase storage (Start→End Broadcast, disconnect-proof). On wrap, an ffmpeg job
                transcodes to MP3 and stream-copies per-segment cuts at marker offsets; downloads are signed
                URLs. Recordings are 100% the commentator&apos;s (no platform license).
              </li>
            </UL>
            <p className="text-[13px]">
              Code: <C>lib/livekit.ts</C>, <C>lib/egress.ts</C>, <C>lib/recording.ts</C>,{" "}
              <C>lib/markers.ts</C>, <C>components/room/audio/*</C>, <C>components/room/DownloadsPanel.tsx</C>.
              The iOS-Safari device matrix is the remaining certification gate.
            </p>
          </Section>

          <Section id="matchdata" title="Match-data pipeline (Sportmonks + Fotmob)">
            <UL>
              <li>
                <b className="text-primary">Stats / events / lineups:</b> <C>lib/stats.ts</C> normalizes a
                Sportmonks fixture into one client-facing shape (13 default + 24 extended stat bars, events
                timeline, lineups with formation positions, deeper xG/momentum/ratings). Served by{" "}
                <C>/api/stats/[fixtureId]</C> behind a 10s in-memory cache + in-flight coalescing + last-good.
                The client polls via <C>useFixtureStats</C> (60s idle / 15s near kickoff &amp; goals).
              </li>
              <li>
                <b className="text-primary">Pre-game Info + History:</b> venue/referee-crew/weather/team-news
                (<C>MatchInfoPanel</C>) + league table &amp; last-5 form from <C>lib/history.ts</C> (
                <C>/api/history</C>, 5-min cache). Weather wind is converted from Sportmonks m/s to mph.
              </li>
              <li>
                <b className="text-primary">Substitutions:</b> applied live from the events feed — the
                incoming player takes the outgoing player&apos;s pitch slot; the outgoing drops to the subs
                list with the minute.
              </li>
              <li>
                <b className="text-primary">Player links:</b> <C>lib/fotmob.ts</C> resolves each lineup
                player to their Fotmob profile (server-derives the name from the trusted lineup; cached in{" "}
                <C>player_fotmob</C>). Link-out only.
              </li>
              <li>
                <b className="text-primary">Cache-warming:</b> the daily matcher also warms a match-data
                snapshot per upcoming matched room (<C>fixture_stats_cache</C>) — a $0 fallback so a room
                stays populated before its first visitor / through an outage.
              </li>
              <li>
                <b className="text-primary">Commentator overrides:</b> the commentator can correct the Info +
                Line-up panels (venue/referee/weather/team-news, fix a name/number, move a player on-pitch /
                bench / out, add a missing player). Stored in <C>room_stat_overrides</C>, pushed live, merged
                onto the Sportmonks data client-side (<C>lib/statOverrides.ts</C>).
              </li>
            </UL>
            <p className="text-[13px]">
              <b className="text-primary">Coverage caveat:</b> the Sportmonks plan covers Premier League / FA
              Cup / Carabao Cup / 2. Bundesliga only. World Cup, internationals, and friendlies return no
              data — those rooms show &quot;Information coming soon&quot; until the plan is upgraded. The room
              still works fully (chat, audio) regardless.
            </p>
          </Section>

          <Section id="security" title="Auth, roles & security">
            <UL>
              <li>
                <b className="text-primary">Auth:</b> Supabase (magic link + OAuth). Three roles —
                listener / commentator / admin. Admins via <C>ADMIN_USER_IDS</C> env (granted at profile
                creation) or <C>npm run grant-role</C>.
              </li>
              <li>
                <b className="text-primary">RLS everywhere</b> (see Data model). Anon can read only public
                rows. All privileged writes use the service role inside an API route, after an explicit
                ownership/role check.
              </li>
              <li>
                <b className="text-primary">Rate limiting:</b> <C>lib/ratelimit.ts</C> — a soft in-memory
                per-instance limiter on open writes (listen-start, link-submit, votes, fotmob-resolve);
                chat/flag/talk keep per-user DB-window limits. A hard global limit would need Upstash/Redis
                (noted).
              </li>
              <li>
                <b className="text-primary">Anti-brigading:</b> vote/flag weighting in <C>lib/standing.ts</C>{" "}
                (established = good standing + ≥48h → full weight, else reduced). Sort modes
                (new/top/controversial) depend on it.
              </li>
              <li>
                <b className="text-primary">SSRF / link safety:</b> the link unfurler is hardened against
                redirect-based SSRF + DNS rebinding; a domain blocklist rejects unauthorized streams. The
                stats proxy is fixture-allowlisted (no client-supplied upstream URL).
              </li>
              <li>
                <b className="text-primary">Headers:</b> a CSP (strict frame-ancestors/object-src/base-uri,
                permissive media/transport so audio + realtime work) + signed-URL scoping for recordings (1h
                TTL, per-object, commentator/admin-only).
              </li>
            </UL>
            <p className="text-[13px]">
              The feature has been through repeated adversarial multi-agent review (the stats/overrides work
              specifically: 22 confirmed findings fixed across rounds, ending on a clean pass). See{" "}
              <C>docs/AUDIT*.md</C>.
            </p>
          </Section>

          <Section id="features" title="Feature tour">
            <H3>The room (the product)</H3>
            <p>
              <C>RealtimeRoom.tsx</C> orchestrates everything. Lifecycle: <b className="text-primary">waiting</b>{" "}
              (countdown to a commentator-set start; optional early chat/links) → <b className="text-primary">
              live</b> (on air; clock driven by the commentator; recording on) → <b className="text-primary">
              wrapped</b> (downloads appear). Desktop layout is stats LEFT 1/3 + a merged stream RIGHT 2/3;
              mobile uses tabs + a collapsible audio drawer.
            </p>
            <H3>The merged stream</H3>
            <p>
              Chat + links interleave into one feed with a per-device filter (all / chat / links).
              Reddit-style: deep threaded replies (collapsible, permalink overlay past depth ~4), up/down
              votes on every item, and sort modes (chronological / top / controversial) with a
              freeze-and-batch &quot;N new&quot; pill in ranked modes. In-stream widgets: score predictor
              (pre-game), half-time poll, player ratings (post-game), commentary↔discussion slider.
            </p>
            <H3>The stats panel</H3>
            <p>
              Tabs: Info / Stats / Events / Line-ups. Pre-game shows a single-column Info (history → team
              news → venue/referee/weather) + a soccer-pitch line-up view; the commentator can push a tab to
              everyone and edit the Info/Line-up data live (see Match-data pipeline).
            </p>
            <H3>Admin</H3>
            <p>
              <C>/admin</C> (admin-gated): create a room for any game from team names + kickoff; &quot;Run
              match check&quot; to resolve it to Sportmonks immediately; a built-in user guide. See{" "}
              <C>components/admin/</C>.
            </p>
          </Section>

          <Section id="status" title="Build status (what's real vs deferred)">
            <Table
              head={["Area", "State"]}
              rows={[
                ["Phases 1–8 (foundation, auth, chat/links/mod, room lifecycle, audio, sync/clock, stats, recording)", <span key="a" className="font-semibold text-green">Code-complete + verified</span>],
                ["Phase 9a (widgets) + 9d (listener metrics) + Info tab", <span key="b" className="font-semibold text-green">Done</span>],
                ["Phase 10 (functional hardening: error states, reconnect drills, RLS audit, CSP, legal pages)", <span key="c" className="font-semibold text-green">Done</span>],
                ["Phase 11 (merged threaded stream, vote sorting, pre-game history) + admin rooms + stats enrichment + commentator editing + Fotmob + cache-warming", <span key="d" className="font-semibold text-green">Done</span>],
                ["Phase 9b/9c — Stripe tipping + Resend going-live emails", <span key="e" className="font-semibold text-gold">Deferred (no Stripe/Resend deps or routes yet)</span>],
                ["iOS Safari audio certification (device matrix)", <span key="f" className="font-semibold text-gold">Pending founder devices</span>],
                ["Final mobile polish + Lighthouse/contrast pass; first public session", <span key="g" className="font-semibold text-gold">Pending</span>],
              ]}
            />
            <p className="text-[13px]">
              <C>docs/PHASES.md</C> is the living checklist with a detailed deviation log — the most accurate
              status source.
            </p>
          </Section>

          <Section id="telemetry" title="Telemetry — current state & where to add it">
            <p>
              This is the main reason you&apos;re here, so it gets the most detail.
            </p>
            <H3>What exists today</H3>
            <UL>
              <li>
                <b className="text-primary">Audio sessions only:</b> <C>listener_segments</C> (one row per
                listen session: room, user-or-anon, mode live/radio, start/heartbeat/end), written by{" "}
                <C>/api/listen</C>. Query pack + <C>npm run metrics</C> in <C>docs/METRICS.md</C> (per-room
                summary, total listen-hours, peak concurrent, retention buckets).
              </li>
              <li>
                <b className="text-primary">Everything else is implicit in the DB:</b> chats, votes, links,
                widget responses, follows, talk requests are all queryable rows, but there is no event stream,
                funnel, or dashboard.
              </li>
              <li>
                <b className="text-primary">Not present at all:</b> error tracking (Sentry et al.), APM/traces,
                product analytics (PostHog/Amplitude), web-vitals reporting, uptime/alerting, and any
                client-side analytics SDK. <C>app/(app)/error.tsx</C> + <C>global-error.tsx</C> render fallback
                UI but report nowhere.
              </li>
            </UL>
            <H3>High-value instrumentation points</H3>
            <UL>
              <li>
                <b className="text-primary">Errors first.</b> Wire an error sink into the existing{" "}
                <C>error.tsx</C> / <C>global-error.tsx</C> boundaries and into every API route&apos;s{" "}
                <C>catch</C>. Routes already fail soft with structured responses — add capture there.
              </li>
              <li>
                <b className="text-primary">API route timing/counters.</b> A thin <C>withTelemetry</C> wrapper
                (or <C>middleware.ts</C>) around routes gives latency + error rate per endpoint. Watch the hot
                ones: <C>/api/chat</C>, the vote routes, <C>/api/stats/[fixtureId]</C>, <C>/api/fotmob/resolve</C>.
              </li>
              <li>
                <b className="text-primary">Sportmonks budget.</b> The stats/history/cache-warming paths all
                hit a rate-limited vendor plan. Count upstream calls (and cache hit/miss) to stay under the
                limit and to size the plan. The 10s cache + coalescing already lives in <C>lib/stats.ts</C> —
                instrument around it.
              </li>
              <li>
                <b className="text-primary">Realtime health.</b> <C>RealtimeRoom</C> already tracks connection
                state (<C>conn</C>), reconnects, presence (watching count), and rehydrate runs — emit those as
                metrics for room reliability.
              </li>
              <li>
                <b className="text-primary">Audio QoE.</b> The sync engine knows offset, buffer depth,
                technical-difficulties events, and listen mode. These are the metrics that actually predict
                churn for this product — surface them (extend <C>listener_segments</C> or a sibling table).
              </li>
              <li>
                <b className="text-primary">Engagement events.</b> If you want funnels (join → listen → chat →
                vote → follow), add a lightweight event emit at the API layer; the DB rows give you the
                backfill.
              </li>
              <li>
                <b className="text-primary">Web Vitals + Vercel.</b> <C>@vercel/analytics</C> +{" "}
                <C>@vercel/speed-insights</C> are near-zero-effort drop-ins; Next&apos;s <C>useReportWebVitals</C>{" "}
                covers LCP/CLS/INP.
              </li>
            </UL>
            <H3>Suggested shape</H3>
            <p>
              Add one <C>lib/telemetry.ts</C> facade (server + client) so the provider is swappable, route all
              emits through it, and respect the existing privacy model: anonymous listeners exist (
              <C>user_id</C> null), so anything user-scoped needs a consent story and must not leak across the
              RLS boundary. Keep heavy aggregation out of the request path (the listener-metrics pattern —
              cheap writes, a scheduled sweep — is the model to copy).
            </p>
          </Section>

          <Section id="env" title="Environment & deployment">
            <H3>Environment variables</H3>
            <p>
              <C>.env.example</C> is the source of truth; <C>.env.local</C> for dev, mirrored into Vercel.
              Categories:
            </p>
            <UL>
              <li>
                <b className="text-primary">Supabase:</b> <C>NEXT_PUBLIC_SUPABASE_URL</C>,{" "}
                <C>NEXT_PUBLIC_SUPABASE_ANON_KEY</C>, <C>SUPABASE_SERVICE_ROLE_KEY</C>.
              </li>
              <li>
                <b className="text-primary">Ably:</b> <C>ABLY_API_KEY</C> (server-side token minting).
              </li>
              <li>
                <b className="text-primary">LiveKit:</b> API key/secret + URL, plus the S3-compatible storage
                creds for egress (recording bucket).
              </li>
              <li>
                <b className="text-primary">Sportmonks:</b> <C>SPORTMONKS_API_TOKEN</C>, <C>SPORTMONKS_BASE</C>.
              </li>
              <li>
                <b className="text-primary">Ops:</b> <C>ADMIN_USER_IDS</C> (comma-list),{" "}
                <C>CRON_SECRET</C> (Bearer for the daily cron — set it in Vercel to enable auto-matching +
                cache-warming). <C>EMAIL_FROM</C>/Resend land with notifications.
              </li>
            </UL>
            <H3>Deployment</H3>
            <UL>
              <li>Vercel, auto-deploy on push to <C>main</C> (production: fancast-26.vercel.app).</li>
              <li>
                <b className="text-primary">Migrations run BEFORE the code that needs them</b> — DB is kept
                ahead of code and back-compatible. <C>npm run migrate</C> (via the session pooler; the direct
                connection is IPv6-only).
              </li>
              <li>
                One Vercel cron in <C>vercel.json</C>: <C>/api/admin/match-fixtures</C> daily (needs{" "}
                <C>CRON_SECRET</C>).
              </li>
            </UL>
            <H3>Run it locally</H3>
            <p>
              <C>npm install</C> → fill <C>.env.local</C> → <C>npm run migrate</C> → <C>npm run dev</C>.
              Verification scripts: <C>npm run metrics</C>, the <C>test:*</C> unit checks, and the{" "}
              <C>smoke*</C> integration scripts (see <C>package.json</C>). Note: there is no Jest/Vitest test
              runner — &quot;tests&quot; are standalone <C>tsx</C> scripts.
            </p>
          </Section>

          <Section id="conventions" title="Conventions & gotchas">
            <UL>
              <li>Server components by default; <C>&quot;use client&quot;</C> only where interactivity needs it.</li>
              <li>All Supabase access through <C>lib/db/</C> helpers; no inline queries in components.</li>
              <li>Every API route validates input with zod before the DB.</li>
              <li>
                Design tokens are CSS variables in <C>app/globals.css</C> (<C>--gold</C>, <C>--green</C>,{" "}
                <C>--red</C>, <C>--line</C>, <C>--surface</C>, <C>--canvas</C>, <C>--primary</C>,{" "}
                <C>--secondary</C>, <C>--raised</C>); Tailwind references them. Both light + dark themes ship
                with every component. Tabular numerals on anything that ticks.
              </li>
              <li>Brand strings only from <C>lib/brand.ts</C> (rename pending).</li>
              <li>
                <b className="text-primary">Gotcha:</b> running <C>next build</C> while <C>next dev</C> is
                running corrupts the shared <C>.next</C> cache (missing vendor chunks). Stop dev before
                building, or use separate checkouts.
              </li>
              <li>
                <b className="text-primary">Gotcha:</b> Postgres <C>numeric</C> serializes as a JSON string —
                coerce vote <C>score</C> with <C>Number()</C> at boundaries.
              </li>
              <li>
                Process: one phase at a time (<C>docs/PHASES.md</C>); commit per working slice; the decision
                log in <C>CLAUDE.md</C> records assumed/founder-confirmed choices.
              </li>
            </UL>
          </Section>

          <Section id="gaps" title="Known gaps / TODO">
            <UL>
              <li>
                <b className="text-primary">Tipping (Stripe)</b> and <b className="text-primary">going-live
                emails (Resend)</b> — designed but not built.
              </li>
              <li>
                <b className="text-primary">iOS Safari audio cert</b> — the device matrix (locked-screen radio
                + sync) is the outstanding gate before a real audio session.
              </li>
              <li>
                <b className="text-primary">Hard rate limits</b> — current limiter is per-lambda-instance;
                move the bucket to Upstash/Redis for a global limit.
              </li>
              <li>
                <b className="text-primary">CRON_SECRET</b> must be set in Vercel for the daily matcher +
                cache-warming to run (the manual &quot;Run match check&quot; button works without it).
              </li>
              <li>
                <b className="text-primary">Legal placeholders</b> in <C>docs/LEGAL_PAGES.md</C> must be filled
                before public launch.
              </li>
              <li>
                <b className="text-primary">A full visual/UX redesign</b> is planned later — the current UI is
                deliberately functional-first; don&apos;t over-invest in polish that the redesign will replace.
              </li>
            </UL>
          </Section>

          <Section id="dig" title="Where to dig in">
            <UL>
              <li><C>CLAUDE.md</C> (repo root) — the brief + decision log + golden rules. Start here.</li>
              <li><C>docs/PHASES.md</C> — living build status + deviation log (most accurate).</li>
              <li><C>docs/ARCHITECTURE.md</C> — the spec (note: drifts ahead of code in a few places).</li>
              <li><C>docs/PRD.md</C> — product requirements + acceptance criteria.</li>
              <li><C>docs/DESIGN.md</C> — tokens, components, clock/state rules.</li>
              <li><C>docs/METRICS.md</C> — the listener-metrics query pack (your telemetry baseline).</li>
              <li><C>docs/RUNBOOK.md</C> + <C>docs/AUDIT*.md</C> — ops + security audits.</li>
              <li>
                Code entry points: <C>components/room/RealtimeRoom.tsx</C> (the room),{" "}
                <C>lib/stats.ts</C> + <C>components/StatsPanel.tsx</C> (match data),{" "}
                <C>lib/clock.ts</C> (the clock), <C>lib/ably.ts</C> (transport).
              </li>
            </UL>
            <p className="pt-2 text-[13px] text-secondary">
              This page is generated, not auto-synced — if the build moves, update{" "}
              <C>app/(app)/dev-docs/page.tsx</C>. It&apos;s <C>noindex</C> and unlisted; to restrict it to
              admins, gate it like <C>app/(app)/admin/page.tsx</C>.
            </p>
          </Section>
        </main>
      </div>
    </div>
  );
}
