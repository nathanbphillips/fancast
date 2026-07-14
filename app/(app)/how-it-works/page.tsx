import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { SyncDiagram } from "@/components/marketing/SyncDiagram";

/**
 * How it works (Matchday design): 2-col hero + compact room preview → four taps
 * → the sync, explained (SyncDiagram) → what's in the room → never miss → host
 * CTA. Listener content preserved. Compliance: "watch" only ever = the viewer's
 * own stream; we never show the match or carry broadcast audio. No em-dashes.
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
      <section className="relative overflow-hidden px-5 py-14 sm:px-10">
        <div
          aria-hidden="true"
          className="animate-fc-glow pointer-events-none absolute -top-44 right-[12%] h-[620px] w-[900px]"
          style={{
            background:
              "radial-gradient(52% 56% at 60% 40%, rgba(239,1,7,.2), transparent 72%)",
          }}
        />
        <div className="relative z-[2] mx-auto grid max-w-[1120px] items-center gap-12 lg:grid-cols-[1.02fr_1.05fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/40 px-[15px] py-2 font-mono text-[12px] text-secondary">
              How it works
            </span>
            <h1 className="display mt-[22px] t-hero">
              Listen along, in{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(120deg,#ff2e28,#ef0107 55%,#b00206)",
                }}
              >
                perfect sync
              </span>{" "}
              with your screen.
            </h1>
            <p className="mt-[22px] max-w-[472px] text-[18px] leading-[1.62] text-secondary">
              {brand.name} sits beside the match you&apos;re already watching.
              Here&apos;s how you pull up a seat, tap in, and line the commentary
              up to your own feed, with a room full of fans to watch it with.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/matches"
                className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-7 py-4 text-[15px] font-semibold text-white"
              >
                See what&apos;s on →
              </Link>
              <Link
                href="/host"
                className="inline-flex items-center gap-2 rounded-[13px] border border-line bg-surface/40 px-[26px] py-4 text-[15px] font-semibold text-primary transition-colors hover:bg-raised"
              >
                Host your own room →
              </Link>
            </div>
          </div>

          {/* compact room preview (decorative, labelled) */}
          <div className="relative" style={{ perspective: "2200px" }} aria-hidden="true">
            <div
              className="pointer-events-none absolute bottom-[-30px] left-1/2 h-[110px] w-[76%] -translate-x-1/2"
              style={{
                background: "radial-gradient(ellipse, rgba(239,1,7,.3), transparent 70%)",
                filter: "blur(30px)",
              }}
            />
            <div className="animate-fcbob absolute top-5 -left-6 z-[6] flex items-center gap-2.5 rounded-[13px] border border-line bg-raised/90 px-3.5 py-2.5 shadow-raised backdrop-blur-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-extrabold text-green" style={{ background: "rgba(52,209,122,.16)" }}>✓</span>
              <span className="text-left">
                <span className="block text-[12px] font-bold text-primary">Synced to your screen</span>
                <span className="block font-mono text-[10px] text-secondary">delay locked · 0.0s</span>
              </span>
            </div>
            <div style={{ transform: "rotateX(4deg) rotateY(-8deg)", transformStyle: "preserve-3d" }}>
              <div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-raised">
                <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-3">
                  <span className="h-[11px] w-[11px] rounded-full" style={{ background: "#3a3a42" }} />
                  <span className="h-[11px] w-[11px] rounded-full" style={{ background: "#3a3a42" }} />
                  <span className="h-[11px] w-[11px] rounded-full" style={{ background: "#3a3a42" }} />
                  <span className="ml-auto rounded-[6px] border border-line px-2 py-1 font-mono text-[10px] font-bold tracking-[0.08em] text-tertiary">PREVIEW</span>
                </div>
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between rounded-[11px] border border-line bg-canvas px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-red font-mono text-[9px] font-bold text-white">ARS</span>
                      <span className="display text-[26px] tabular-nums">2</span>
                    </span>
                    <span className="font-mono text-[12px] text-red tabular-nums">1H 23:14</span>
                    <span className="flex items-center gap-2">
                      <span className="display text-[26px] tabular-nums">0</span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-[7px] font-mono text-[9px] font-bold text-white" style={{ background: "#6a1a2c" }}>BUR</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-[11px] border border-line bg-canvas px-3.5 py-3">
                    <span className="h-[34px] w-[34px] rounded-full" style={{ background: "linear-gradient(135deg,#ef0107,#7a0a12)" }} />
                    <span className="flex-1">
                      <span className="block text-[12px] font-bold">Your host</span>
                      <span className="block font-mono text-[10px] text-secondary">a real Arsenal supporter</span>
                    </span>
                    <span className="flex h-[18px] items-end gap-[2px]">
                      {[0.1, 0.45, 0.25].map((d, i) => (
                        <span key={i} className="animate-fceq w-[3px] rounded-[2px] bg-red" style={{ height: "18px", animationDelay: `-${d}s` }} />
                      ))}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="flex-1 rounded-[9px] border border-line bg-canvas py-[9px] text-center font-mono text-[11px] text-secondary">−0.5s</span>
                    <span className="btn-grad-red flex-[1.6] rounded-[9px] py-[9px] text-center font-mono text-[10px] font-extrabold text-white">◎ SYNC NOW</span>
                    <span className="flex-1 rounded-[9px] border border-line bg-canvas py-[9px] text-center font-mono text-[11px] text-secondary">+0.5s</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-[11px] border border-line bg-canvas px-3.5 py-3">
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

      {/* FOUR TAPS */}
      <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10">
        <div className="mb-8">
          <div className={`${eyebrow} mb-3`}>FOR LISTENERS</div>
          <h2 className="display t-h2">Four taps to the room.</h2>
          <p className="mt-3 max-w-[560px] text-[16px] text-secondary">
            You keep watching the game your way. We line the commentary up to
            your screen and give you a room full of fans to watch it with.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-line bg-surface p-[22px] transition-colors hover:border-red/30"
            >
              <div className="display text-[32px] leading-none text-red">{s.n}</div>
              <div className="mt-3 mb-[7px] text-[17px] font-extrabold">{s.t}</div>
              <p className="text-[13px] leading-[1.55] text-secondary">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THE SYNC, EXPLAINED */}
      <section className="relative overflow-hidden border-t border-line px-5 py-16 sm:px-10">
        <div className="relative z-[2] mx-auto grid max-w-[1010px] items-center gap-12 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="h-px w-[22px] bg-red" />
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

      {/* WHAT'S IN THE ROOM */}
      <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10">
        <div className="mb-8">
          <div className={`${eyebrow} mb-3`}>WHAT&apos;S WAITING IN THE ROOM</div>
          <h2 className="display t-h2">Everything&apos;s live and free to read.</h2>
          <p className="mt-3 max-w-[540px] text-[16px] text-secondary">
            All of it runs during the match and costs nothing to follow. Joining
            in, chatting, voting, calling in, just needs a one-minute account.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.t}
              className="rounded-2xl border border-line bg-surface p-[22px] transition-transform hover:-translate-y-[3px]"
            >
              <div className="text-[18px] font-extrabold">{f.t}</div>
              <p className="mt-[7px] text-[13px] leading-[1.55] text-secondary">
                {f.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* NOT JUST MATCHDAY */}
      <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10">
        <div
          className="grid items-center gap-8 overflow-hidden rounded-[18px] border border-line p-8 md:grid-cols-[1.1fr_1fr]"
          style={{ background: "var(--bg-raised)" }}
        >
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
                className="btn-grad-red inline-flex items-center rounded-[11px] px-5 py-3 text-[13px] font-semibold text-white"
              >
                See what&apos;s on now →
              </Link>
              <Link
                href="/host"
                className="inline-flex items-center rounded-[11px] border border-line px-5 py-3 text-[13px] font-semibold text-primary transition-colors hover:bg-canvas"
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
                className="flex items-center gap-3 rounded-[14px] border border-line bg-canvas p-3.5"
              >
                <span
                  className={`h-[11px] w-[11px] shrink-0 rounded-full ${r.live ? "animate-fcpulse bg-red" : "bg-tertiary"}`}
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

      {/* NEVER MISS */}
      <section className="mx-auto max-w-[1120px] px-5 pb-14 sm:px-10">
        <div
          className="grid items-center gap-8 overflow-hidden rounded-[18px] border p-8 md:grid-cols-2"
          style={{
            background:
              "linear-gradient(120deg, rgba(239,1,7,.14), transparent 55%), var(--bg-surface)",
            borderColor: "rgba(239,1,7,.28)",
          }}
        >
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
            <div className="flex items-center gap-3 rounded-[14px] border border-line bg-canvas p-3.5 shadow-glow">
              <span className="h-[11px] w-[11px] shrink-0 animate-fcpulse rounded-full bg-red" />
              <span className="flex-1">
                <span className="block text-[13px] font-bold">A room you follow is live</span>
                <span className="block text-[12px] text-secondary">tap to jump in</span>
              </span>
              <span className="font-mono text-[11px] text-tertiary">now</span>
            </div>
            <div className="flex items-center gap-3 rounded-[14px] border border-line bg-canvas p-3.5">
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
      <section className="mx-auto max-w-[1120px] px-5 pb-16 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-[18px] border border-line bg-raised p-8">
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
              className="btn-grad-red rounded-[11px] px-6 py-3.5 text-center text-[14px] font-semibold text-white"
            >
              Host your own room →
            </Link>
            <Link
              href="/host/guide"
              className="rounded-[11px] border border-line px-6 py-3.5 text-center text-[14px] font-semibold text-primary hover:bg-canvas"
            >
              Host handbook
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
