import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { brand } from "@/lib/brand";

/**
 * The Host handbook (/host/guide): the operator manual for commentators, and
 * the middle layer of the documentation stack — /host and /about persuade,
 * /dev-docs explains the engineering, this explains how to actually run a
 * show. Task-oriented, organized by the matchday timeline (industry pattern:
 * creator handbooks a la Twitch Creator Camp / OBS quickstart). Public on
 * purpose: prospective hosts and partners read it before committing.
 *
 * Every claim here is grounded in the real controls (CommentatorBar,
 * ClockControls, RoomCreatePicker, HostRoomsDashboard, DownloadsPanel,
 * lib/commentator-terms.ts). If a control changes, update this page.
 * Compliance: audio-only rule prominent; never implies showing the match;
 * no em-dashes.
 */

export const metadata: Metadata = {
  title: "Host handbook",
  description:
    "The working manual for hosting a room: setting up, going on air, running the show, and what you keep afterwards.",
};

const TOC = [
  { id: "become", label: "Become a commentator" },
  { id: "setup", label: "Set up your room" },
  { id: "before", label: "Before kickoff" },
  { id: "onair", label: "Going on air" },
  { id: "running", label: "Running the show" },
  { id: "moderation", label: "Moderation" },
  { id: "after", label: "After the final whistle" },
  { id: "rule", label: "The one rule" },
  { id: "faq", label: "Quick answers" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-8">
      <h2 className="t-title font-extrabold tracking-[-0.01em] text-primary">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.6] text-secondary">
        {children}
      </div>
    </section>
  );
}

/** A control or button name in body text. */
function B({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-primary">{children}</span>;
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="ml-5 list-decimal space-y-2">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

export default function HostGuidePage() {
  return (
    <>
      {/* INTRO */}
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(110% 90% at 85% -20%, rgba(241,35,43,0.12), transparent 56%), var(--bg-base)",
        }}
      >
        <div className="relative mx-auto max-w-[1180px] px-5 pt-14 pb-10 sm:px-10">
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-red uppercase">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-red"
            />
            Host handbook
          </p>
          <h1 className="display max-w-[760px] t-hero tracking-[0.005em] text-primary">
            How to run your room
          </h1>
          <p className="mt-5 max-w-[600px] t-lead text-secondary">
            The working manual for hosting on {brand.name}: setting up, going on
            air, running the show, and what you keep afterwards. If you are
            deciding <em>whether</em> to host, start with{" "}
            <Link href="/host" className="font-semibold text-red hover:underline">
              the pitch
            </Link>
            ; this page is for when you are ready to do it.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-5 py-12 sm:px-10 lg:grid lg:grid-cols-[210px_1fr] lg:gap-12">
        {/* sticky contents */}
        <nav
          className="mb-8 lg:sticky lg:top-24 lg:mb-0 lg:self-start"
          aria-label="Contents"
        >
          <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.14em] text-secondary uppercase">
            On this page
          </p>
          <ul className="space-y-1.5 text-[13.5px]">
            {TOC.map((t) => (
              <li key={t.id}>
                <a
                  className="text-secondary hover:text-primary hover:underline"
                  href={`#${t.id}`}
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 max-w-[720px] space-y-8">
          <Section id="become" title="Become a commentator">
            <p>
              Any account can upgrade. Go to <B>Settings</B>, hit{" "}
              <B>Become a commentator</B>, read the terms, tick the box, and you
              can host today. No application, no waiting. In plain English, the
              terms say four things:
            </p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <B>Your recordings are yours.</B> Completely. {brand.name} takes
                no rights, no license, no exclusivity.
              </li>
              <li>
                <B>Audio only, never the match.</B> Your show is your voice and
                your guests; never play match video or broadcast audio through
                it. Breaking this means suspension (see{" "}
                <a href="#rule" className="text-red hover:underline">
                  the one rule
                </a>
                ).
              </li>
              <li>
                <B>You are responsible for your show.</B> You moderate your
                room; the community guidelines apply to you, your co-host, and
                your callers.
              </li>
              <li>
                <B>Hosting can be suspended</B> for breaking the terms; your
                listener account and history stay intact.
              </li>
            </ul>
          </Section>

          <Section id="setup" title="Set up your room">
            <Steps
              items={[
                <span key="1">
                  From <B>My rooms</B>, hit <B>Create room</B> and pick an
                  upcoming fixture from the schedule.
                </span>,
                <span key="2">
                  Two inputs, that is it: <B>when your show starts</B> (defaults
                  to fifteen minutes before kickoff, so you have time to warm
                  up) and an optional one-line <B>blurb</B>, your angle on the
                  game in 140 characters.
                </span>,
                <span key="3">
                  Your room gets a clean, permanent link like{" "}
                  <span className="font-mono text-[13px]">
                    /room/arsenal-vs-chelsea-04-dec-2026-you
                  </span>
                  . Share it anywhere; there is a <B>Share</B> button on the
                  room and next to it on the schedule.
                </span>,
              ]}
            />
            <p>
              <B>Match not in the list? Create your own room.</B> On the create
              page, <B>Create your own room</B> takes just a title and a start
              time, and the start can be right now (your waiting room opens
              immediately) or any time in the future. Give it a title like
              &quot;Arsenal vs Chelsea&quot;; as you type, we search the
              competitions we cover, and picking a suggestion links the room to
              the real match so live stats flow automatically. If your game
              isn&apos;t in our data feed, the room still works fully (chat,
              audio, recordings, everything); it just shows &quot;Information
              coming soon&quot; in place of stats, and the create page has a box
              to tell us which league we should add next. We&apos;re early and
              started with a handful of competitions; more are on the way.
            </p>
            <p>
              <B>Host a whole season:</B> in the fixture picker, <B>Or host the
              whole season</B> schedules a room for every game your team plays
              in that competition this season, and new fixtures get their room
              automatically as they appear. Unsubscribing cancels the future
              rooms it created.
            </p>
            <p>
              <B>Bring a co-host:</B> from My rooms, invite another commentator
              to share a room as an equal. Two hosts max; either of you can run
              everything; both of you appear on the room and both keep the
              recordings.
            </p>
            <p>
              <B>Plans change:</B> cancel any scheduled room from My rooms.
              Listeners who RSVP&apos;d are notified. A room you never open
              quietly expires on its own, so an abandoned room never strands an
              audience.
            </p>
          </Section>

          <Section id="before" title="Before kickoff: the waiting room">
            <p>Your room opens in a waiting state. From the control bar:</p>
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <B>Start time · Set</B> gives listeners a countdown to your
                show. No time set shows a calm &quot;starts soon&quot; card.
              </li>
              <li>
                <B>Chat open</B> / <B>Links open</B> let the room warm up before
                you are on air.
              </li>
              <li>
                The room shows how many people are planning to attend, and
                listeners who hit <B>Count me in</B> get a reminder before you
                start.
              </li>
              <li>
                Your followers get a nudge when you schedule a room and when you
                go live, so showing up on time compounds: consistency builds an
                audience. (Email and push alerts are rolling out during early
                access.)
              </li>
            </ul>
          </Section>

          <Section id="onair" title="Going on air">
            <Steps
              items={[
                <span key="1">
                  <B>Start mic</B>. You need a live microphone before you can
                  broadcast. <B>Mute</B> and <B>Mic off</B> are always one tap
                  away.
                </span>,
                <span key="2">
                  <B>Start Broadcast</B>. You are on air: chat, links, questions
                  and call-ins unlock for everyone, and{" "}
                  <B>recording starts here</B> (the waiting room is never
                  recorded).
                </span>,
                <span key="3">
                  <B>Drive the clock</B> to match the broadcast:{" "}
                  <B>Start 1H</B> → <B>Halftime</B> → <B>Start 2H</B> →{" "}
                  <B>Full time</B>, with extra time if needed and{" "}
                  <B>−1s / +1s</B> nudges to line it up exactly.
                </span>,
              ]}
            />
            <p>
              <B>The clock is sacred.</B> Listeners align your commentary to
              their own screens using your clock as the reference, so keep it
              honest to the live broadcast and never run it ahead of the action.
            </p>
            <p>
              <B>Watching on a delay?</B> Set your own <B>Delay</B> (up to 5
              seconds) and your voice is held back to match, so you can watch a
              slightly delayed feed and still sound in sync to everyone else.
            </p>
          </Section>

          <Section id="running" title="Running the show">
            <p>
              <B>Stats run themselves.</B> Score, possession, shots, xG,
              line-ups and events fill in live for covered competitions
              (Premier League, FA Cup, Carabao Cup and 2. Bundesliga today).
              You can <B>push</B> any stats tab onto every listener&apos;s
              screen when something is worth looking at, and <B>edit</B> the
              match info and line-ups if the data feed gets something wrong.
              Uncovered competitions show &quot;Information coming soon&quot;;
              the room still works fully.
            </p>
            <p>
              <B>Widgets:</B> the score predictor runs before kickoff on its
              own; you create the <B>half-time poll</B>; player ratings open at
              half-time and again after the whistle.
            </p>
            <p>
              <B>Call-ins:</B> when a listener requests the mic, a card appears
              with their topic. <B>Accept</B> puts them on air (two guests max);{" "}
              <B>Dismiss</B> declines quietly. Ending a call is neutral, it does
              nothing to their account. For problem callers, the flag leaves a
              private note other hosts can see, and a block (reversible) bars
              call-ins only.
            </p>
            <p>
              <B>Questions</B> arrive in a private inbox only the hosts can see;
              answer the good ones on air or in chat.
            </p>
          </Section>

          <Section id="moderation" title="Moderation">
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <B>Hide</B> any message with the ✕; it hides the whole reply
                thread underneath it for everyone.
              </li>
              <li>
                The room also moderates itself: listeners can flag messages
                (each gets 10 flags per match) and enough weighted flags
                auto-hide one. Votes from established accounts count more, so
                brigading is blunted.
              </li>
              <li>
                Links to unauthorized streams and blocked domains are rejected
                automatically; you never have to police that by hand.
              </li>
              <li>
                You are the moderator of record for your room. Set the tone
                early; it sticks.
              </li>
            </ul>
          </Section>

          <Section id="after" title="After the final whistle">
            <p>
              <B>End Broadcast</B> (it asks you to confirm) stops the recording
              and wraps the room. A <B>Downloads</B> panel appears for you: the
              full show plus per-segment clips (pre-game, first half, halftime
              show, second half...), each cut at your clock events. If a
              boundary is off, adjust it by up to two minutes and recut.
            </p>
            <p>
              The files are MP3s, named and ready to publish wherever you like:
              your podcast feed, YouTube, anywhere. They are 100% yours;{" "}
              {brand.name} claims nothing.
            </p>
          </Section>

          <Section id="rule" title="The one rule">
            <div className="rounded-2xl border border-red/30 bg-inset px-6 py-6">
              <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-red uppercase">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-red"
                />
                Audio only, always
              </p>
              <p className="text-sm leading-[1.6] text-secondary">
                Your show is your voice and your guests. Never play match video
                or broadcast audio through it, even in the background, even for
                a moment. Your listeners bring their own screens; you bring the
                commentary. This rule is what keeps the whole platform on the
                right side of the line, and it is the one thing that ends
                hosting privileges immediately.
              </p>
            </div>
          </Section>

          <Section id="faq" title="Quick answers">
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <B>What equipment do I need?</B> A microphone and a browser.
                A quiet room and a decent headset beat expensive gear.
              </li>
              <li>
                <B>Do my listeners pay?</B> No. Listening is free and needs no
                account; people sign up only to chat, vote, or call in.
              </li>
              <li>
                <B>Can I see what listeners experience?</B> Yes, read{" "}
                <Link
                  href="/how-it-works"
                  className="text-red hover:underline"
                >
                  how it works
                </Link>{" "}
                for the listener side, including how they sync your commentary
                to their own screens.
              </li>
              <li>
                <B>What if my match has no stats?</B> As a new product in its
                early days we focused our data coverage on a few competitions
                first: the Premier League, FA Cup, Carabao Cup and 2. Bundesliga
                today. Anything else shows &quot;Information coming soon&quot;,
                and chat, audio, and recordings all work regardless. We are
                adding more leagues as soon as we are able, and we appreciate
                your patience while we get there.
              </li>
              <li>
                <B>Something broke mid-show?</B> Keep talking. Listeners
                reconnect automatically and the room rebuilds itself; the
                recording runs server-side, so a glitch on your end does not
                lose the show.
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3.5 border-t border-line pt-8">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-[11px] bg-red px-6 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-red-hover"
              >
                Become a commentator <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/host/new"
                className="inline-flex items-center rounded-[11px] border border-line px-[22px] py-[15px] text-[15px] font-bold text-primary transition-colors hover:border-primary"
              >
                Create your first room
              </Link>
            </div>
          </Section>
        </main>
      </div>
    </>
  );
}
