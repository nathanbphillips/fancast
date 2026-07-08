import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { HeroProductShot } from "@/components/marketing/HeroProductShot";
import { SyncDiagram } from "@/components/marketing/SyncDiagram";

/**
 * How it works (in depth, Matchday redesign): the listener side of the product
 * (the host story lives at /host). Marketing content, self-contained. Compliance:
 * "watch" only ever = the viewer's own stream; we never show the match or carry
 * broadcast audio. No em-dashes.
 */

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How to listen along to live fan commentary, synced to your own screen. Bring your stream, tap in, and watch with a room full of fans.",
};

const eyebrow =
  "inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red";

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

export default function HowItWorksPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden px-5 pt-16 pb-10 sm:px-10">
        <div
          aria-hidden="true"
          className="animate-fc-glow pointer-events-none absolute -top-40 right-0 h-[560px] w-[760px]"
          style={{
            background:
              "radial-gradient(54% 56% at 60% 40%, rgba(239,1,7,.14), transparent 72%)",
          }}
        />
        <div className="relative z-[2] mx-auto max-w-[760px] text-center">
          <div className={`${eyebrow} justify-center`}>HOW IT WORKS</div>
          <h1 className="display mt-4 t-hero text-primary">
            Listen along, synced to your screen.
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[18px] leading-[1.6] text-secondary">
            {brand.name} sits beside the match you are already watching. Here is
            how you pull up a seat, tap in, and line the commentary up to your
            own feed.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/matches"
              className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-7 py-4 text-[15px] font-semibold text-white"
            >
              See what&apos;s on <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/host"
              className="inline-flex items-center gap-2 rounded-[13px] border border-line bg-surface/40 px-[26px] py-4 text-[15px] font-semibold text-primary transition-colors hover:bg-raised"
            >
              Host your own room →
            </Link>
          </div>
        </div>
        <HeroProductShot />
      </section>

      {/* FOUR TAPS */}
      <section className="mx-auto max-w-[1010px] px-5 py-16 sm:px-10">
        <div className={`${eyebrow} mb-3`}>FOR LISTENERS</div>
        <h2 className="display max-w-[640px] t-h2">Four taps to the room</h2>
        <p className="mt-4 max-w-[560px] text-[15px] leading-[1.6] text-secondary">
          You keep watching the game your way. We line up the commentary to your
          screen and give you a room full of fans to watch it with.
        </p>
        <div className="mt-9 grid gap-[18px] sm:grid-cols-2">
          {LISTENER_STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-line bg-raised px-6 pt-6 pb-7 shadow-card"
            >
              <span
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] font-mono text-sm font-bold text-red"
                style={{ background: "rgba(239,1,7,.12)" }}
              >
                {s.n}
              </span>
              <h3 className="mt-5 t-title font-extrabold">{s.t}</h3>
              <p className="mt-2.5 text-sm leading-[1.55] text-secondary">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SYNC EXPLAINER */}
      <section className="relative overflow-hidden border-t border-line px-5 py-16 sm:px-10">
        <div className="relative z-[2] mx-auto grid max-w-[1010px] items-center gap-12 lg:grid-cols-[.92fr_1.08fr]">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="h-px w-[22px] bg-red" />
              <span className={eyebrow}>THE SYNC, UP CLOSE</span>
            </div>
            <h2 className="display t-h2">Your telly lags. One tap fixes it.</h2>
            <p className="mt-4 max-w-[420px] text-[16px] leading-[1.62] text-secondary">
              Every stream runs on its own delay. Watch the timeline: the fan
              audio sits at the live edge until you tap <b className="text-primary">Now</b>{" "}
              at the moment your screen shows, and it snaps onto your exact feed.
              From then on you can nudge it half a second either way, or jump back
              to live.
            </p>
          </div>
          <SyncDiagram />
        </div>
      </section>

      {/* WHAT'S IN THE ROOM */}
      <section className="mx-auto max-w-[1010px] px-5 py-16 sm:px-10">
        <div className={`${eyebrow} mb-3`}>IN THE ROOM</div>
        <h2 className="display max-w-[640px] t-h2">What is waiting in the room</h2>
        <p className="mt-4 mb-9 max-w-[560px] text-[14px] text-secondary">
          Everything below is live during the match and free to read. Joining in
          takes an account.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {LISTENER_FEATURES.map((f, i) => (
            <div
              key={f.k}
              className="rounded-2xl border border-line bg-raised px-6 pt-[26px] pb-7 transition-transform hover:-translate-y-[3px]"
            >
              <p className="mb-3.5 font-mono text-[11px] text-red tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="t-title font-extrabold">{f.k}</h3>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-secondary">
                {f.d}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-raised px-6 py-6">
          <h3 className="t-title font-extrabold">Never miss the first whistle</h3>
          <p className="mt-2 max-w-[640px] text-sm leading-[1.6] text-secondary">
            Follow a commentator and get a nudge by email or push when they
            schedule a room or go live. You choose exactly which notifications
            reach you, and how, from your settings. One click unsubscribes from
            any of them.
          </p>
        </div>

        {/* pointer to the host story */}
        <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-inset px-6 py-6 sm:flex-row sm:items-center">
          <div>
            <p className="t-title font-extrabold">Rather run the show?</p>
            <p className="mt-1 max-w-lg text-sm text-secondary">
              Any account can become a commentator and host a room in about a
              minute. The whole show is yours to keep.
            </p>
          </div>
          <Link
            href="/host"
            className="btn-grad-red inline-flex shrink-0 items-center gap-2 rounded-[11px] px-[22px] py-3.5 text-[15px] font-semibold text-white"
          >
            Host your own room →
          </Link>
        </div>
      </section>
    </>
  );
}
