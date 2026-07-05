import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

/**
 * How it works (in depth): the listener side of the product (the host story now
 * lives on its own page at /host). Marketing content page, self-contained (Cloud
 * Design tokens). Compliance: "watch" only ever = the viewer's own stream; we
 * never show the match or carry broadcast audio. No em-dashes.
 */

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How to listen along to live fan commentary, synced to your own screen. Bring your stream, tap in, and watch with a room full of fans.",
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
          <h1 className="display max-w-[760px] text-[42px] leading-[0.96] tracking-[0.005em] text-primary sm:text-[62px]">
            Listen along, synced to your screen.
          </h1>
          <p className="mt-5 max-w-[560px] text-[18px] leading-[1.55] text-secondary">
            {brand.name} sits beside the match you are already watching. Here is
            how you pull up a seat, tap in, and line the commentary up to your
            own feed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <Link
              href="/matches"
              className="inline-flex items-center gap-2 rounded-[11px] bg-red px-6 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-red-hover"
            >
              See what&apos;s on <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/host"
              className="inline-flex items-center rounded-[11px] border border-gold/45 px-[22px] py-[15px] text-[15px] font-bold text-gold transition-colors hover:border-gold"
            >
              Host your own room <span aria-hidden="true">→</span>
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

          {/* pointer to the host story (which lives at /host now) */}
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-inset px-6 py-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-lg font-extrabold tracking-[-0.01em]">
                Rather run the show?
              </p>
              <p className="mt-1 max-w-lg text-sm text-secondary">
                Any account can become a commentator and host a room in about a
                minute. The whole show is yours to keep.
              </p>
            </div>
            <Link
              href="/host"
              className="inline-flex shrink-0 items-center gap-2 rounded-[11px] border border-gold/45 px-[22px] py-[13px] text-[15px] font-bold text-gold transition-colors hover:border-gold"
            >
              Host your own room <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
