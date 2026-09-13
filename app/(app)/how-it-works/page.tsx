import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { SyncDiagram } from "@/components/marketing/SyncDiagram";
import { DEMO_ROOM_HREF } from "@/lib/config";

/**
 * How it works (Programme design): notes-for-supporters hero + compact room
 * preview, FOUR TAPS TO THE ROOM 2x2 grid, the sync explained in a boxed panel
 * (SyncDiagram), WHAT'S WAITING IN THE ROOM definition grid, rooms around the
 * clock, never miss the first whistle, demo + host CTAs. Listener content
 * preserved. Compliance: "watch" only ever = the viewer's own stream; we never
 * show the match or carry broadcast audio. No em dashes.
 */

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How to listen along to live fan commentary, synced to your own screen. Bring your stream, tap in, and watch with a room full of fans.",
};

const eyebrow =
  "inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red";

const STEPS = [
  {
    n: "01",
    t: "Bring your own stream",
    d: `Watch however you already do. ${brand.name} never shows the game or carries broadcast audio, it rides alongside.`,
  },
  {
    n: "02",
    t: "Press play",
    d: "Open a live room and tap in for fan commentary. You don't even need an account to listen along.",
  },
  {
    n: "03",
    t: "Sync to your screen",
    d: "When your screen hits the moment on the clock, tap Now. The audio locks to your feed, nudge it, or jump to live.",
  },
  {
    n: "04",
    t: "Pull up a seat",
    d: "Sign up in under a minute to chat, vote, ask the commentator or call in. Reading is always open.",
  },
];

const FEATURES = [
  {
    t: "A chat worth reading",
    d: "Threaded replies, up- and down-votes, and sort by New, Top or Controversial. Good takes rise, noise sinks.",
  },
  {
    t: "The stats that matter",
    d: "Score, possession, shots, xG, momentum, lineups and team news, live from kickoff.",
  },
  {
    t: "Ask, vote, rate",
    d: "Question the commentator, settle the half-time poll, and rate the players at the whistle.",
  },
  {
    t: "Call in",
    d: "Request the mic and the host can bring you on air. Leave any time with one tap.",
  },
  {
    t: "Radio mode",
    d: "Prefer it in the background? Continuous audio with your screen locked and controls on your lock screen.",
  },
  {
    t: "Bring your friends",
    d: "RSVP to a room, follow the commentators you like, add friends, and build a fan score as you show up.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* HERO (2-col: copy + compact room preview) */}
      <section className="relative px-5 py-14 sm:px-10">
        <div className="relative z-[2] mx-auto grid max-w-[1120px] items-center gap-12 lg:grid-cols-[1.02fr_1.05fr]">
          <div>
            <span className={eyebrow}>Notes for supporters</span>
            <h1 className="display mt-[22px] t-hero">How it works</h1>
            <p className="mt-[22px] max-w-[472px] text-[18px] leading-[1.62] text-secondary italic">
              Listen along, in perfect sync with your screen. {brand.name} sits
              beside the match you&apos;re already watching - it never shows the
              game or carries broadcast audio, it rides alongside.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/matches"
                className="btn-grad-red inline-flex items-center gap-2 px-7 py-4 text-[15px] font-semibold"
              >
                See what&apos;s on →
              </Link>
              <Link
                href="/host"
                className="inline-flex items-center gap-2 border-2 border-primary px-[26px] py-4 font-mono text-[14px] font-semibold tracking-[0.08em] text-primary transition-colors hover:text-red"
              >
                Host your own room →
              </Link>
            </div>
          </div>

          {/* compact room preview (decorative, labelled) */}
          <div className="relative" aria-hidden="true">
            <div className="animate-fcbob absolute top-5 -left-6 z-[6] flex items-center gap-2.5 border border-line bg-canvas px-3.5 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-green text-[15px] font-extrabold text-green">✓</span>
              <span className="text-left">
                <span className="block text-[12px] font-bold text-primary">Synced to your screen</span>
                <span className="block font-mono text-[10px] text-secondary">delay locked · 0.0s</span>
              </span>
            </div>
            <div>
              <div className="border-2 border-primary bg-canvas">
                <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-3">
                  <span className="h-[11px] w-[11px] rounded-full bg-line" />
                  <span className="h-[11px] w-[11px] rounded-full bg-line" />
                  <span className="h-[11px] w-[11px] rounded-full bg-line" />
                  <span className="ml-auto border border-line px-2 py-1 font-mono text-[10px] font-bold tracking-[0.08em] text-tertiary">PREVIEW</span>
                </div>
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between border border-line bg-canvas px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center bg-red-fill font-mono text-[9px] font-bold text-on-red">ARS</span>
                      <span className="display text-[26px] tabular-nums">2</span>
                    </span>
                    <span className="font-mono text-[12px] text-red tabular-nums">1H 23:14</span>
                    <span className="flex items-center gap-2">
                      <span className="display text-[26px] tabular-nums">0</span>
                      <span className="flex h-6 w-6 items-center justify-center font-mono text-[9px] font-bold text-white" style={{ background: "#6a1a2c" }}>BUR</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 border border-line bg-canvas px-3.5 py-3">
                    <span className="h-[34px] w-[34px] rounded-full bg-red-fill" />
                    <span className="flex-1">
                      <span className="block text-[12px] font-bold">Your host</span>
                      <span className="block font-mono text-[10px] text-secondary">a real Arsenal supporter</span>
                    </span>
                    <span className="flex h-[18px] items-end gap-[2px]">
                      {[0.1, 0.45, 0.25].map((d, i) => (
                        <span key={i} className="animate-fceq w-[3px] bg-red-fill" style={{ height: "18px", animationDelay: `-${d}s` }} />
                      ))}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="flex-1 border border-line bg-canvas py-[9px] text-center font-mono text-[11px] text-secondary">−0.5s</span>
                    <span className="btn-grad-red flex-[1.6] py-[9px] text-center font-mono text-[10px] font-extrabold">◎ SYNC NOW</span>
                    <span className="flex-1 border border-line bg-canvas py-[9px] text-center font-mono text-[11px] text-secondary">+0.5s</span>
                  </div>
                  <div className="flex items-center gap-2.5 border border-line bg-canvas px-3.5 py-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: "#2a4a8a" }}>N</span>
                    <span className="min-w-0">
                      <span className="text-[11px] font-bold">Nathan</span>{" "}
                      <span className="text-[11px] text-secondary">Ødegaard, take a bow.</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOUR TAPS TO THE ROOM (2x2) */}
      <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10">
        <div className="mb-8 border-b-[3px] border-double border-primary pb-5">
          <div className={`${eyebrow} mb-3`}>FOR LISTENERS</div>
          <h2 className="display t-h2">Four taps to the room.</h2>
          <p className="mt-3 max-w-[560px] text-[16px] text-secondary italic">
            You keep watching the game your way. We line the commentary up to
            your screen and give you a room full of fans to watch it with.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="border border-line bg-canvas p-[22px]"
            >
              <div className="display text-[32px] leading-none text-red">{s.n}</div>
              <div className="mt-3 mb-[7px] text-[17px] font-extrabold">{s.t}</div>
              <p className="text-[13px] leading-[1.55] text-secondary">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THE SYNC, EXPLAINED (boxed panel) */}
      <section className="relative px-5 py-16 sm:px-10">
        <div className="relative z-[2] mx-auto grid max-w-[1010px] items-center gap-12 border-2 border-primary bg-canvas p-8 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="h-px w-[22px] bg-red-fill" />
              <span className={eyebrow}>THE SYNC, EXPLAINED</span>
            </div>
            <h2 className="display t-h2">A reference clock ticks. You tap Now. It locks.</h2>
            <p className="mt-4 max-w-[420px] text-[16px] leading-[1.62] text-secondary">
              TVs and streams all run at different delays, so a shared watchalong
              is never in step with your screen. {brand.name} shows a reference
              match-clock. The instant your own feed reaches that moment, tap{" "}
              <b className="text-primary">Now</b>, and the commentary snaps to your
              exact screen. Half-second steppers fine-tune it, and you can jump
              back to the live edge whenever.
            </p>
            <div className="mt-4 text-[13px] text-tertiary">
              Watch on a delay? A slight nudge either way and you&apos;re back in
              sync.
            </div>
          </div>
          <SyncDiagram />
        </div>
      </section>

      {/* WHAT'S WAITING IN THE ROOM (definition grid) */}
      <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10">
        <div className="mb-8 border-b-[3px] border-double border-primary pb-5">
          <div className={`${eyebrow} mb-3`}>WHAT&apos;S WAITING IN THE ROOM</div>
          <h2 className="display t-h2">Everything&apos;s live and free to read.</h2>
          <p className="mt-3 max-w-[540px] text-[16px] text-secondary italic">
            All of it runs during the match and costs nothing to follow. Joining
            in, chatting, voting, calling in, just needs a one-minute account.
          </p>
        </div>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.t}
              className="border-t border-line pt-4"
            >
              <div className="text-[18px] font-extrabold">{f.t}</div>
              <p className="mt-[7px] text-[13px] leading-[1.55] text-secondary">
                {f.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ROOMS OPEN AROUND THE CLOCK */}
      <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10">
        <div className="grid items-center gap-8 border-2 border-primary bg-canvas p-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <div className={`${eyebrow} mb-3`}>ANY TIME, NOT JUST MATCHDAY</div>
            <h2 className="display t-h3">Rooms open around the clock.</h2>
            <p className="mt-3 max-w-[460px] text-[15px] leading-[1.6] text-secondary">
              Matchdays are the heart of it, but a room is just a live audio
              space. Any host can spin one up any time to talk transfers, react
              to the news, or run a regular show. No game on? It&apos;s pure chat
              and audio. Talking about another match? The host links it and its
              stats ride alongside.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/matches"
                className="btn-grad-red inline-flex items-center px-5 py-3 text-[13px] font-semibold"
              >
                See what&apos;s on now →
              </Link>
              <Link
                href="/host"
                className="inline-flex items-center border-2 border-primary px-5 py-3 font-mono text-[12px] font-semibold tracking-[0.08em] text-primary transition-colors hover:text-red"
              >
                Open a discussion room →
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              { t: "Transfer deadline phone-in", m: "live now", live: true },
              { t: "Sunday night: the week in review", m: "8:00 PM", live: false },
              { t: "Post-match reaction", m: "at full time", live: false },
            ].map((r) => (
              <div
                key={r.t}
                className={`flex items-center gap-3 border bg-canvas p-3.5 ${r.live ? "border-red" : "border-line"}`}
              >
                <span
                  className={`h-[11px] w-[11px] shrink-0 rounded-full ${r.live ? "animate-fcpulse bg-red-fill" : "bg-tertiary"}`}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                  {r.t}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-tertiary">
                  {r.m}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEVER MISS THE FIRST WHISTLE */}
      <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10">
        <div className="grid items-center gap-8 border-2 border-red bg-canvas p-8 md:grid-cols-2">
          <div>
            <div className={`${eyebrow} mb-3`}>STAY IN THE LOOP</div>
            <h2 className="display t-h3">Never miss the first whistle.</h2>
            <p className="mt-3 max-w-[400px] text-[15px] leading-[1.6] text-secondary">
              Follow a commentator and get a nudge by email or push when they
              schedule a room or go live. You choose exactly which notifications
              reach you, and how, one click unsubscribes from any of them.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3 border border-red bg-canvas p-3.5">
              <span className="h-[11px] w-[11px] shrink-0 animate-fcpulse rounded-full bg-red-fill" />
              <span className="flex-1">
                <span className="block text-[13px] font-bold">A room you follow is live</span>
                <span className="block text-[12px] text-secondary">tap to jump in</span>
              </span>
              <span className="font-mono text-[11px] text-tertiary">now</span>
            </div>
            <div className="flex items-center gap-3 border border-line bg-canvas p-3.5">
              <span className="h-[11px] w-[11px] shrink-0 rounded-full bg-tertiary" />
              <span className="flex-1">
                <span className="block text-[13px] font-bold">A new room was scheduled</span>
                <span className="block text-[12px] text-secondary">for a match you care about</span>
              </span>
              <span className="font-mono text-[11px] text-tertiary">2h</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOST CTA */}
      {/* SEE IT LIVE — demo room CTA */}
      <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10">
        <div className="relative border border-line bg-canvas p-8 text-center">
          <div className="relative z-[2]">
            <div className={`${eyebrow} mb-2.5`}>SEE IT FOR YOURSELF</div>
            <h2 className="display t-h3">Take a walk through a live room.</h2>
            <p className="mx-auto mt-2.5 max-w-[480px] text-[14px] leading-[1.55] text-secondary">
              Our demo room is open to everyone, no account needed. Click around
              the chat, stats and polls to feel a matchday before you join a real
              one.
            </p>
            <Link
              href={DEMO_ROOM_HREF}
              className="btn-grad-red mt-5 inline-flex items-center px-6 py-3.5 text-[14px] font-semibold"
            >
              See the demo room →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 pb-16 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-5 border-2 border-primary bg-canvas p-8">
          <div>
            <div className={`${eyebrow} mb-2.5`}>RATHER RUN THE SHOW?</div>
            <div className="display t-h3">Any account can host a room.</div>
            <p className="mt-2 max-w-[520px] text-[14px] text-secondary">
              Become a commentator in about a minute. The whole show is yours to
              keep, and there&apos;s no platform fee.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <Link
              href="/host"
              className="btn-grad-red px-6 py-3.5 text-center text-[14px] font-semibold"
            >
              Host your own room →
            </Link>
            <Link
              href="/host/guide"
              className="border-2 border-primary px-6 py-3.5 text-center font-mono text-[13px] font-semibold tracking-[0.08em] text-primary hover:text-red"
            >
              Host handbook
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
