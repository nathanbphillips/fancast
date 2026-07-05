import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

/**
 * How it works (in depth): a listeners section up top, then a commentators
 * section anchored at #hosting so links elsewhere can jump straight to it.
 * Marketing content page, self-contained (Cloud Design tokens). Compliance:
 * "watch" only ever = the viewer's own stream; we never show the match or carry
 * broadcast audio. No em-dashes.
 */

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How to listen along to live fan commentary, and how to host your own room.",
};

const LISTENER_STEPS = [
  {
    n: "01",
    t: "Bring your own stream",
    d: `Watch the match however you already do: your telly, your app, your subscription. ${brand.name} never shows the game or carries broadcast audio. It rides alongside whatever you are already watching.`,
  },
  {
    n: "02",
    t: "Press play",
    d: "Open a live room and tap in for fan commentary. You do not even need an account to listen along.",
  },
  {
    n: "03",
    t: "Sync to your screen",
    d: "TVs and streams run at different delays. Tap the sync readout, and when your screen hits the moment shown on the clock, tap Now. The audio locks to your feed. Nudge it half a second either way any time, or jump straight back to the live edge.",
  },
  {
    n: "04",
    t: "Pull up a seat",
    d: "Sign up in under a minute to join in: chat, vote, ask the commentator, or call in. Reading is always open; writing just needs an account.",
  },
];

const LISTENER_FEATURES = [
  {
    k: "A chat worth reading",
    d: "Threaded replies, up and down votes, and sort by New, Top, or Controversial. Good takes rise, noise sinks.",
  },
  {
    k: "The stats that matter",
    d: "Score, possession, shots, xG, momentum, lineups and team news, live from kickoff.",
  },
  {
    k: "Ask, vote, rate",
    d: "Question the commentator, settle the half-time poll, and rate the players at the whistle.",
  },
  {
    k: "Call in",
    d: "Request the mic and the host can bring you on air. Leave any time with one tap.",
  },
  {
    k: "Radio mode",
    d: "Prefer it in the background? Radio mode plays continuous audio with your screen locked and controls on your lock screen.",
  },
  {
    k: "Bring your friends",
    d: "RSVP to a room, follow the commentators you like, add friends, and build a fan score as you show up and take part.",
  },
];

const HOST_STEPS = [
  {
    n: "01",
    t: "Become a commentator",
    d: "Any account can upgrade from settings: read the terms, tick the box, and you can host today. No application, no waiting.",
  },
  {
    n: "02",
    t: "Create a room",
    d: "Pick an upcoming fixture from the schedule. Two inputs, that is it: when your show starts (it defaults to fifteen minutes before kickoff) and an optional one-line blurb. Everything else comes from the fixture, and your room gets a clean, shareable link.",
  },
  {
    n: "03",
    t: "Host a whole season",
    d: "One click schedules a room for every game your team plays this season, and new fixtures get their room automatically as they appear.",
  },
  {
    n: "04",
    t: "Bring a co-host",
    d: "Invite another commentator to share the room as an equal. Either of you can run everything, both of you appear on the room, and both of you keep the recordings.",
  },
  {
    n: "05",
    t: "Go on air",
    d: "Open the waiting room, start the broadcast, run the clock, moderate the chat, take call-ins, and push stats. Your listeners are with you the whole way.",
  },
  {
    n: "06",
    t: "Keep your show",
    d: `Every broadcast is recorded and cut into downloadable segments. You own them, one hundred percent. ${brand.name} takes no license, no exclusivity, nothing.`,
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
      {children}
    </p>
  );
}

function StepCard({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 pt-6 pb-7">
      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-gold font-mono text-sm font-bold text-[#141210]">
        {n}
      </span>
      <h3 className="mt-5 text-xl font-extrabold tracking-[-0.01em]">{t}</h3>
      <p className="mt-2.5 text-sm leading-[1.55] text-secondary">{d}</p>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      {/* INTRO */}
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(110% 90% at 85% -20%, rgba(241,35,43,0.16), transparent 56%), var(--bg-base)",
        }}
      >
        <div className="relative mx-auto max-w-[1180px] px-5 pt-16 pb-10 sm:px-10">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="display max-w-[760px] text-[42px] leading-[0.96] tracking-[0.005em] text-white sm:text-[62px]">
            Listen along, or host the room yourself.
          </h1>
          <p className="mt-5 max-w-[560px] text-[18px] leading-[1.55] text-secondary">
            {brand.name} sits beside the match you are already watching. Here is
            how it works, whether you are pulling up a seat or running the show.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <Link
              href="/matches"
              className="inline-flex items-center gap-2 rounded-[11px] bg-red px-6 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-red-hover"
            >
              See what&apos;s live <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="#hosting"
              className="inline-flex items-center rounded-[11px] border border-gold/45 px-[22px] py-[15px] text-[15px] font-bold text-gold transition-colors hover:border-gold"
            >
              Want to commentate? <span aria-hidden="true">↓</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOR LISTENERS */}
      <section>
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-10">
          <Eyebrow>For listeners</Eyebrow>
          <h2 className="display max-w-[640px] text-4xl leading-[0.95] sm:text-[52px]">
            Four taps to the room
          </h2>
          <p className="mt-4 max-w-[560px] text-[15px] leading-[1.6] text-secondary">
            You keep watching the game your way. We line up the commentary to
            your screen and give you a room full of fans to watch it with.
          </p>

          <div className="mt-9 grid gap-[18px] sm:grid-cols-2">
            {LISTENER_STEPS.map((s) => (
              <StepCard key={s.n} {...s} />
            ))}
          </div>

          <h3 className="mt-14 mb-1 text-2xl font-extrabold tracking-[-0.01em]">
            What is waiting in the room
          </h3>
          <p className="mb-8 max-w-[560px] text-[14px] text-secondary">
            Everything below is live during the match and free to read. Joining
            in takes an account.
          </p>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 md:grid-cols-3">
            {LISTENER_FEATURES.map((f, i) => (
              <div
                key={f.k}
                className="bg-canvas px-6 pt-[26px] pb-7 transition-colors hover:bg-surface"
              >
                <p className="mb-3.5 font-mono text-[11px] text-gold">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h4 className="text-[19px] font-extrabold tracking-[-0.01em]">
                  {f.k}
                </h4>
                <p className="mt-2 text-[13.5px] leading-[1.55] text-secondary">
                  {f.d}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-6">
            <h4 className="text-lg font-extrabold tracking-[-0.01em]">
              Never miss the first whistle
            </h4>
            <p className="mt-2 max-w-[640px] text-sm leading-[1.6] text-secondary">
              Follow a commentator and get a nudge by email or push when they
              schedule a room or go live. You choose exactly which notifications
              reach you, and how, from your settings. One click unsubscribes from
              any of them.
            </p>
          </div>
        </div>
      </section>

      {/* FOR COMMENTATORS (anchor target) */}
      <section
        id="hosting"
        className="scroll-mt-24 border-t border-line"
        style={{
          background:
            "radial-gradient(100% 80% at 50% 0%, rgba(241,35,43,0.06), transparent 60%)",
        }}
      >
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-10">
          <Eyebrow>For commentators</Eyebrow>
          <h2 className="display max-w-[680px] text-4xl leading-[0.95] sm:text-[52px]">
            Host your own room
          </h2>
          <p className="mt-4 max-w-[580px] text-[15px] leading-[1.6] text-secondary">
            If you know the club and you can hold a mic, there is a seat for you
            at the front. Setting up a room takes about a minute, and the whole
            show is yours to keep.
          </p>

          <div className="mt-9 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {HOST_STEPS.map((s) => (
              <StepCard key={s.n} {...s} />
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-red/30 bg-inset px-6 py-6">
            <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-red uppercase">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red" />
              The one rule
            </p>
            <h4 className="text-lg font-extrabold tracking-[-0.01em]">
              Audio only, always
            </h4>
            <p className="mt-2 max-w-[680px] text-sm leading-[1.6] text-secondary">
              Your show is your voice and your guests. Never play match video or
              broadcast audio through it, even in the background. That rule is
              what keeps the whole platform on the right side of the line, and it
              is the one thing we cannot bend.
            </p>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3.5">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-[11px] bg-red px-6 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-red-hover"
            >
              Become a commentator <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center rounded-[11px] border border-line px-[22px] py-[15px] text-[15px] font-bold transition-colors hover:bg-surface"
            >
              Read more about {brand.name}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
