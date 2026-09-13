import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { DEMO_ROOM_HREF } from "@/lib/config";
import { PageMasthead, PageTitle } from "@/components/marketing/PageMasthead";

/**
 * Page 2: HOW IT WORKS (Programme redesign - the mock's page, layout and copy,
 * founder 2026-09-13). Subpage masthead -> title block -> FOUR TAPS TO THE
 * ROOM 2x2 -> the sync explained in a boxed panel with the static stepper ->
 * WHAT'S WAITING IN THE ROOM definition grid -> the two-up around-the-clock /
 * never-miss section -> CTA row. Compliance: never shows the game, never
 * carries broadcast audio; no em dashes.
 */

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Listen along to live fan commentary, in perfect sync with your own screen. Bring your stream, tap in, pull up a seat.",
};

const TAPS = [
  {
    n: "1.",
    t: "Bring your own stream",
    d: `Watch however you already do. ${brand.name} rides alongside whatever you pay for.`,
  },
  {
    n: "2.",
    t: "Press play",
    d: "Open a live room and tap in for fan commentary. No account needed to listen along.",
  },
  {
    n: "3.",
    t: "Sync to your screen",
    d: (
      <>
        When your screen hits the moment on the clock, tap{" "}
        <b className="text-primary">Now</b>. The audio locks to your feed - nudge
        it, or jump to live.
      </>
    ),
  },
  {
    n: "4.",
    t: "Pull up a seat",
    d: "Sign up in under a minute to chat, vote, ask the commentator or call in. Reading is always open.",
  },
];

const WAITING = [
  [
    "A chat worth reading",
    "Threaded replies, up- and down-votes, sort by New, Top or Controversial. Good takes rise, noise sinks.",
  ],
  [
    "The stats that matter",
    "Score, possession, shots, xG, momentum, lineups and team news, live from kickoff.",
  ],
  [
    "Ask, vote, rate",
    "Question the commentator, settle the half-time poll, rate the players at the whistle.",
  ],
  [
    "Call in",
    "Request the mic and the host can bring you on air. Leave any time with one tap.",
  ],
  [
    "Radio mode",
    "Continuous audio with your screen locked and controls on your lock screen.",
  ],
  [
    "Bring your friends",
    "RSVP to a room, follow the commentators you like, and build a fan score as you show up.",
  ],
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-5 pt-6 pb-14 sm:px-10">
      <PageMasthead page={2} />
      <PageTitle
        kicker="Notes for supporters"
        title="How it works"
        standfirst={
          <>
            Listen along, in perfect sync with your screen. {brand.name} sits
            beside the match you&apos;re already watching - it never shows the
            game or carries broadcast audio, it rides alongside.
          </>
        }
      />

      {/* FOUR TAPS TO THE ROOM */}
      <div className="mt-9">
        <h2 className="display border-b-[3px] border-double border-primary pb-2.5 text-center text-[28px]">
          Four taps to the room
        </h2>
        <div className="mt-1.5 grid sm:grid-cols-2">
          {TAPS.map((s, i) => (
            <div
              key={s.t}
              className={`py-5 sm:px-6 ${i % 2 === 0 ? "sm:border-r sm:border-line sm:pl-0" : "sm:pr-0"} ${
                i < 2 ? "border-b border-line" : ""
              }`}
            >
              <div className="display text-[22px]">
                <span className="text-red">{s.n}</span> {s.t}
              </div>
              <p className="mt-2 text-[16.5px] leading-[1.6] text-secondary">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* THE SYNC, EXPLAINED */}
      <div className="mt-9 border-2 border-primary p-6 sm:p-8">
        <p className="font-mono text-[14px] tracking-[0.16em] text-red">
          The sync, explained
        </p>
        <h2 className="display mt-2 text-[30px]">
          A reference clock ticks. You tap Now. It locks.
        </h2>
        <p className="mt-3 max-w-[760px] text-[17px] leading-[1.65] text-secondary">
          TVs and streams all run at different delays, so a shared watchalong is
          never in step with your screen. {brand.name} shows a reference
          match-clock. The instant your own feed reaches that moment, tap{" "}
          <b className="text-primary">Now</b>, and the commentary snaps to your
          exact screen. Half-second steppers fine-tune it, and you can jump back
          to the live edge whenever.
        </p>
        <div className="mt-4.5 flex flex-wrap items-center gap-3.5 font-mono text-[14px] tracking-[0.1em]">
          <span className="border border-line px-3.5 py-2 whitespace-nowrap">−0.5s</span>
          <span className="bg-red-fill px-4.5 py-2 whitespace-nowrap text-on-red">
            ◎ Sync now
          </span>
          <span className="border border-line px-3.5 py-2 whitespace-nowrap">+0.5s</span>
          <span className="text-secondary italic whitespace-nowrap">
            locked · 0.0s ✓
          </span>
        </div>
      </div>

      {/* WHAT'S WAITING IN THE ROOM */}
      <div className="mt-9">
        <h2 className="display border-b-[3px] border-double border-primary pb-2.5 text-center text-[28px]">
          What&apos;s waiting in the room
        </h2>
        <p className="mt-3 text-center text-[16.5px] text-secondary italic">
          Everything&apos;s live and free to read. Joining in - chatting,
          voting, calling in - just needs a one-minute account.
        </p>
        <div className="mt-5 grid gap-x-5 gap-y-3.5 sm:grid-cols-[170px_1fr]">
          {WAITING.map(([label, copy]) => (
            <div key={label} className="contents">
              <span className="font-mono text-[15px] font-semibold tracking-[0.1em]">
                {label}
              </span>
              <span className="mb-2 text-[16.5px] leading-[1.6] text-secondary sm:mb-0">
                {copy}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AROUND THE CLOCK / NEVER MISS */}
      <div className="mt-9 grid gap-8 border-t border-primary pt-6 md:grid-cols-2">
        <div>
          <h2 className="display text-[22px]">Rooms open around the clock</h2>
          <p className="mt-2 text-[16.5px] leading-[1.6] text-secondary">
            Matchdays are the heart of it, but any host can spin up a room any
            time - transfers, news reaction, a regular show. No game on? Pure
            chat and audio.
          </p>
        </div>
        <div>
          <h2 className="display text-[22px]">Never miss the first whistle</h2>
          <p className="mt-2 text-[16.5px] leading-[1.6] text-secondary">
            Follow a commentator and get a nudge by email or push when they
            schedule a room or go live. You choose which alerts reach you - one
            click unsubscribes.
          </p>
        </div>
      </div>

      {/* CTA ROW */}
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href={DEMO_ROOM_HREF}
          className="btn-grad-red px-6 py-3.5 text-[16px] whitespace-nowrap"
        >
          See the demo room →
        </Link>
        <Link
          href="/"
          className="border-2 border-primary px-6 py-3 font-mono text-[15px] tracking-[0.12em] whitespace-nowrap text-primary hover:text-red"
        >
          Back to the fixtures →
        </Link>
        <Link
          href="/host"
          className="border-2 border-red px-6 py-3 font-mono text-[15px] tracking-[0.12em] whitespace-nowrap text-red hover:opacity-80"
        >
          Rather run the show? Host a room →
        </Link>
      </div>
    </div>
  );
}
