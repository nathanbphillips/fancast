import type { ReactNode } from "react";

/**
 * Admin user guide — a reference for how the room + admin tools are built and
 * how to drive them. Written for the founder now; the seed of the future
 * "introductory commentator guide" for new users. Kept in sync with the actual
 * controls (CommentatorBar, ClockControls, MicControls, the Phase 11 stream).
 */

function Section({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      open={open}
      className="group rounded-xl border-[0.75px] border-line bg-surface px-4 py-3"
    >
      <summary className="cursor-pointer list-none text-sm font-bold marker:content-none">
        <span className="mr-2 inline-block text-secondary transition-transform group-open:rotate-90">
          ›
        </span>
        {title}
      </summary>
      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-secondary">
        {children}
      </div>
    </details>
  );
}

/** A control name in body text. */
function B({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-primary">{children}</span>;
}

export function AdminGuide() {
  return (
    <section className="mt-10" aria-label="User guide">
      <h2 className="text-lg font-bold tracking-tight">User guide</h2>
      <p className="mt-1 mb-4 text-sm text-secondary">
        How this is built and how to run it. (We&apos;ll grow this into the
        new-commentator onboarding guide later.)
      </p>

      <div className="space-y-2">
        <Section title="Creating a room" open>
          <p>
            The form above makes a room for <em>any</em> game from just{" "}
            <B>Home team</B>, <B>Away team</B>, and <B>Kickoff</B> (entered in
            your local time). The room&apos;s title is always just
            “Home&nbsp;vs&nbsp;Away” — there are no custom titles or other knobs
            by design, so every room has the same structure.
          </p>
          <p>
            On submit you&apos;re dropped straight into the room as the
            commentator, and it opens in the <B>waiting</B> state. The room is
            public — anyone can join and listen — but only an admin can create
            one.
          </p>
          <p>
            Venue, weather, referee, stats and the league table fill in
            automatically once Sportmonks has the game (see the next section).
          </p>
        </Section>

        <Section title="Match data & “Information coming soon”">
          <p>
            All match data comes from Sportmonks. The current plan covers{" "}
            <B>Premier League, FA Cup, Carabao Cup and 2.&nbsp;Bundesliga only</B>
            . World Cup, internationals and friendlies are <em>not</em> covered —
            those rooms show “Information coming soon” and won&apos;t fill in
            until the plan is upgraded. The room still works fully (chat, audio,
            everything) regardless.
          </p>
          <p>
            A <B>daily check</B> matches your created games to Sportmonks by team
            name + date. To match one immediately, click{" "}
            <B>Run match check</B> above. Once matched, the Info tab shows
            venue/referee/weather, the History pane shows both teams&apos; table
            position + last-5 form, and live stats flow during the game.
          </p>
          <p className="text-[11px]">
            Tip: enter clean team names (“Burnley”, not “Burnley FC (test)”) so
            the matcher can resolve them. The daily cron needs{" "}
            <code className="rounded bg-raised px-1">CRON_SECRET</code> set in
            Vercel; until then, use the button.
          </p>
        </Section>

        <Section title="Going live — the broadcast lifecycle">
          <p>
            Your control strip is at the top of the room on mobile and the bottom
            on desktop. The flow, start to finish:
          </p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              <B>Waiting room</B> — where a new room starts. Optionally set a{" "}
              <B>Start time</B> (gives listeners a countdown) and flip{" "}
              <B>Chat</B>/<B>Links</B> open so people can warm up. Until you go
              live, listeners see a “show starts soon” card.
            </li>
            <li>
              <B>Start mic</B> — you must have a live mic before you can go on
              air.
            </li>
            <li>
              <B>Start Broadcast</B> — goes on air (pre-game). Unlocks chat,
              links, questions and call-ins for everyone, and{" "}
              <strong>recording starts here</strong>.
            </li>
            <li>
              <B>Drive the clock</B> to match your TV:{" "}
              <B>Start&nbsp;1H</B> → <B>Halftime</B> → <B>Start&nbsp;2H</B> →{" "}
              <B>Full&nbsp;time</B>, with optional <B>Start&nbsp;ET</B> →{" "}
              <B>End&nbsp;ET</B>. Use <B>−1s / +1s</B> to line the clock up with
              your feed.
            </li>
            <li>
              <B>End Broadcast</B> (two-step: End → <B>Confirm end</B>). Stops
              recording and wraps the room; your downloads appear afterwards.
            </li>
          </ol>
          <p className="text-[11px]">
            The clock and score are the listeners&apos; reference — never tick it
            ahead of your own feed, or sync-to-my-TV breaks for them.
          </p>
        </Section>

        <Section title="Commentator bar — every button">
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <B>Start time · Set · Clear</B> (waiting) — the listener countdown
              target. Optional; no time set = a calm “starts soon” card.
            </li>
            <li>
              <B>Chat open/closed</B>, <B>Links open/closed</B> (waiting) — let
              listeners chat or post links before you&apos;re on air.
            </li>
            <li>
              <B>Start mic</B> → <B>Mute / Muted</B> · <B>Mic off</B> — your
              microphone. <B>Delay</B> (Off–5s) is a self-delay so you can watch a
              delayed broadcast and stay in sync with the live action.
            </li>
            <li>
              <B>Start Broadcast</B> / <B>End Broadcast → Confirm end</B> — the
              on-air toggle.
            </li>
            <li>
              <B>Clock</B> — Start&nbsp;1H / Halftime / Start&nbsp;2H /
              Full&nbsp;time / Start&nbsp;ET / End&nbsp;ET, plus −1s&nbsp;/&nbsp;+1s.
            </li>
            <li>
              <B>Talk requests</B> (live) — when a listener asks to call in a card
              appears: <B>Accept</B> puts them on air, <B>Dismiss</B> declines.
              The <B>⚑</B> flags a problem caller (a private note other
              commentators see) or blocks them from calling in; <B>✕</B> on an
              on-air guest ends their call (no effect on their account).
            </li>
          </ul>
        </Section>

        <Section title="What listeners see & do">
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <B>The stream</B> (right side) — chat and link cards in one feed. A
              filter switches <B>All / Chat / Links</B>; a sort switches{" "}
              <B>New / Top / Controversial</B> (the ranked sorts freeze the order
              and hold new items behind an “N new — refresh” pill so nothing jumps
              under you).
            </li>
            <li>
              <B>Threaded replies</B> — every message and link can be replied to,
              with collapsible nesting and up/down votes on each item; deep chains
              open in a focused thread view.
            </li>
            <li>
              <B>Voting</B> — up/down on everything. Established accounts&apos;
              votes count more (anti-brigading) and voting is rate-limited.
            </li>
            <li>
              <B>Widgets</B> in the stream — <B>Score predictor</B> (pre-game),{" "}
              <B>half-time poll</B> (you create it), <B>player ratings</B>{" "}
              (post-game), and the commentary↔discussion <B>slider</B>.
            </li>
            <li>
              <B>Stats panel</B> (left) — pre-game <B>Info | History</B> split;
              live stats / events / line-ups during the game. You can{" "}
              <B>push</B> a stats tab to everyone&apos;s screen.
            </li>
            <li>
              <B>Audio</B> — listeners press play, can switch to <B>Radio</B> for
              background listening, set <B>volume</B>, and <B>Sync to my TV</B> to
              align your commentary to their own feed.
            </li>
          </ul>
        </Section>

        <Section title="Moderation">
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <B>Hide a message</B> — the <B>✕</B> on any message (you/admin
              only) hides it and its whole reply thread for everyone.
            </li>
            <li>
              <B>Flags</B> — listeners can flag messages; enough weighted flags
              auto-hide one. Each listener gets 10 flags per match.
            </li>
            <li>
              <B>Callers</B> — <B>⚑</B> flags or blocks a problem caller (block is
              reversible and only bars call-ins); <B>✕</B> ends an on-air call.
            </li>
            <li>
              <B>Links</B> to unauthorised streams / blocked domains are rejected
              automatically.
            </li>
          </ul>
        </Section>

        <Section title="After the match">
          <p>
            Once you End Broadcast the room wraps and a <B>Downloads</B> panel
            appears (for you, in the centre): the full recording plus per-segment
            clips — pre-game, each half, etc. — with a ±2-minute adjust + recut if
            a boundary is off. The recordings are yours; the platform claims no
            rights to them.
          </p>
        </Section>
      </div>
    </section>
  );
}
