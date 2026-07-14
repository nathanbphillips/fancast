import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

/**
 * About / Voices (Matchday design): manifesto hero → problem/idea/promise cards
 * → stat band → four principles → founder → the voices (archetypes) → FAQ grid
 * → CTA. Copy verbatim (no em-dashes). The compliance FAQ stays prominent.
 * Voices are illustrative archetypes; no photos, no fabricated follower counts.
 */

export const metadata: Metadata = {
  title: "Voices",
  description: `What ${brand.name} is, how a matchday works, and why it's fans in your ear instead of pundits.`,
};

const eyebrow =
  "inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red";

const STORY = [
  {
    h: "THE PROBLEM",
    p: "Pundits hedge. Streams lag. The group chat moves too fast to read. Watching with other fans got harder, not easier, and nobody's on your side for the full ninety.",
  },
  {
    h: "THE IDEA",
    p: "Keep your own stream. Add a live fan host, a chat worth reading, and the stats on tap, all synced to your screen with one tap. We don't show the game; we sit beside it.",
  },
  {
    h: "THE PROMISE",
    p: "Hosts keep and own every recording. Independent, unofficial, and built for supporters, never for rights-holders.",
  },
];

const STATS = [
  { n: "0", c: "pundits on the payroll", red: false },
  { n: "100%", c: "of recordings owned by hosts", red: true },
  { n: "<1min", c: "to sign up and join in", red: false },
  { n: "£0", c: "to listen, no account needed", red: false },
];

const PRINCIPLES = [
  {
    k: "Fans, never pundits",
    d: "Every room is hosted by a supporter who actually cares about the result. No neutral takes, no broadcast script, just someone on your side.",
  },
  {
    k: "We sit beside the game",
    d: `${brand.name} never streams the match. You bring your own feed; we bring the voice, the chat and the stats that ride alongside it.`,
  },
  {
    k: "Hosts keep their work",
    d: "Every show records into downloadable segments owned by the host. We take no rights and claim nothing. The room is theirs.",
  },
  {
    k: "Independent & unofficial",
    d: "Fan-made and unaffiliated with any club, league or broadcaster. Answerable to supporters, not rights-holders.",
  },
];

const VOICES = [
  {
    i: "DG",
    grad: "linear-gradient(135deg,#ef0107,#7a0a12)",
    t: "The lifelong Gooner",
    d: "Lives and dies with every result and calls it exactly as they see it. Never neutral, never on the fence.",
  },
  {
    i: "TH",
    grad: "linear-gradient(135deg,#1f6f4a,#0c3a26)",
    t: "The tactics head",
    d: "Will talk you through the xG and the press triggers, then happily ignore all of it the second we score a worldie.",
  },
  {
    i: "CH",
    grad: "linear-gradient(135deg,#2a4a8a,#12224a)",
    t: "The call-in host",
    d: "Runs the half-time poll and the call-in mic on the big nights, so the whole room gets a say.",
  },
];

const FAQ = [
  {
    q: "Do you stream the match?",
    a: `No, and we never will. ${brand.name} doesn't show match video or play broadcast audio. You watch however you already legally do; we ride alongside with fan commentary, chat and stats.`,
  },
  {
    q: "Is this official Arsenal?",
    a: `No. ${brand.name} is an unofficial, fan-made platform, not affiliated with or endorsed by Arsenal, the Premier League, or any broadcaster.`,
  },
  {
    q: "Do I need to pay or sign up?",
    a: "No. Anyone can listen and read the chat and stats without an account. You only sign up, in under a minute, to chat, vote, ask a question or call in.",
  },
  {
    q: "Is it only during matches?",
    a: `No. Matchdays are the heart of it, but any host can open a room any time to talk transfers, react to the news, or just hang out. When there's no game it's chat and audio; when a host is talking about another match, its stats ride alongside. The goal is a place Arsenal fans can find a conversation any time of day.`,
  },
  {
    q: "How does the sync work?",
    a: "A reference match-clock ticks on screen. When your feed shows that exact moment, tap Now and the commentary lines up. Half-second steppers fine-tune it; jump back to live whenever.",
  },
  {
    q: "Does it work on my iPhone?",
    a: `Yes. ${brand.name} runs in the browser including iOS Safari, installs to your home screen, and keeps playing audio on the lock screen like a radio.`,
  },
  {
    q: "Is it only Arsenal?",
    a: "For now, yes. We're starting with Arsenal and doing it properly. More clubs will follow.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* MANIFESTO HERO */}
      <section className="relative overflow-hidden px-5 pt-[70px] pb-12 text-center sm:px-10">
        <div
          aria-hidden="true"
          className="animate-fc-glow pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[1000px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(56% 56% at 50% 40%, rgba(239,1,7,.2), transparent 72%)",
          }}
        />
        <div className="relative z-[2] mx-auto max-w-[820px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/40 px-[15px] py-2 font-mono text-[12px] text-secondary">
            About {brand.name}
          </span>
          <h1 className="display mt-6 t-hero">
            Not a broadcaster.
            <br />
            Fans &amp; friends,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(120deg,#ff2e28,#ef0107 55%,#b00206)",
              }}
            >
              hanging out
            </span>
            .
          </h1>
          <p className="mx-auto mt-[22px] max-w-[600px] text-[18px] leading-[1.62] text-secondary">
            Match coverage got polished into something that forgot who it was
            for. {brand.name} is the opposite: a real supporter in your ear, the
            chat you&apos;d have at the pub, and the numbers that actually matter,
            riding alongside whatever stream you already watch.
          </p>
        </div>
      </section>

      {/* PROBLEM / IDEA / PROMISE */}
      <section className="mx-auto max-w-[1010px] px-5 pb-5 sm:px-10">
        <div className="grid gap-3 md:grid-cols-3">
          {STORY.map((s) => (
            <div
              key={s.h}
              className="rounded-2xl border border-line bg-surface p-[26px]"
              style={{ borderTop: "2px solid #ef0107" }}
            >
              <div className="mb-3 font-mono text-[11px] tracking-[0.08em] text-tertiary">
                {s.h}
              </div>
              <p className="text-[16px] leading-[1.6] text-primary/90">{s.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STAT BAND */}
      <section className="mt-7 border-y border-line px-5 py-10 sm:px-10">
        <div className="mx-auto grid max-w-[1010px] grid-cols-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.c}
              className={`px-5 text-center ${i > 0 ? "md:border-l md:border-line" : ""}`}
            >
              <div
                className={`display text-[44px] ${s.red ? "text-red" : "text-primary"}`}
              >
                {s.n}
              </div>
              <div className="mt-1 text-[13px] text-secondary">{s.c}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOUR PRINCIPLES */}
      <section className="mx-auto max-w-[1010px] px-5 pt-16 pb-10 sm:px-10">
        <div className={`${eyebrow} mb-3`}>WHAT WE STAND FOR</div>
        <h2 className="display t-h2">Four things we won&apos;t budge on.</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <div
              key={p.k}
              className="flex gap-[18px] rounded-2xl border border-line bg-surface p-[26px] transition-colors hover:border-line"
            >
              <div className="display shrink-0 text-[30px] leading-none text-red">
                0{i + 1}
              </div>
              <div>
                <h3 className="text-[19px] font-extrabold tracking-[-0.01em]">
                  {p.k}
                </h3>
                <p className="mt-[7px] text-[14px] leading-[1.6] text-secondary">
                  {p.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOUNDER */}
      <section className="mx-auto max-w-[1010px] px-5 pb-14 sm:px-10">
        <div
          className="relative grid items-center gap-8 overflow-hidden rounded-[20px] border border-line p-9 sm:grid-cols-[auto_1fr]"
          style={{ background: "linear-gradient(135deg,#161318,#0f0e11)" }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-8 h-[280px] w-[280px]"
            style={{
              background:
                "radial-gradient(circle, rgba(239,1,7,.14), transparent 68%)",
            }}
          />
          <div className="relative z-[2] text-center">
            <span
              className="flex h-24 w-24 items-center justify-center rounded-[24px] font-mono text-[34px] font-extrabold text-white"
              style={{
                background: "linear-gradient(135deg,#ef0107,#7a0a12)",
                boxShadow: "0 20px 40px -18px rgba(239,1,7,.7)",
              }}
            >
              NP
            </span>
            <div className="mt-3 text-[14px] font-bold">Nathan Phillips</div>
            <div className="text-[11px] text-tertiary">Founder · Gooner</div>
          </div>
          <div className="relative z-[2]">
            <div className={`${eyebrow} mb-3`}>MADE BY A FAN, NOT A MEDIA COMPANY</div>
            <p className="mb-3.5 text-[17px] leading-[1.62] text-primary/90">
              {brand.name} is built by Nathan Phillips, an Arsenal supporter who
              grew up in Detroit and adopted a team in North London the way
              plenty of us did: from afar, at odd hours, often on the sofa alone.
              Watching with pundits who didn&apos;t care about the result stopped
              being fun, so this is the room he wanted to watch in.
            </p>
            <p className="mb-[18px] text-[15px] leading-[1.6] text-secondary">
              It&apos;s early and it&apos;s independent, built in the open rather
              than behind a press release. If you&apos;ve got a thought, a bug, or
              a club you want to see next, the door is open.
            </p>
            <a
              href="https://bsky.app/profile/nathanphillips.bsky.social"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface/40 px-[18px] py-[11px] text-[13px] font-semibold text-primary transition-colors hover:bg-raised"
            >
              Say hello on Bluesky →
            </a>
          </div>
        </div>
      </section>

      {/* THE VOICES */}
      <section className="mx-auto max-w-[1010px] px-5 pb-14 sm:px-10">
        <div className={`${eyebrow} mb-3`}>THE VOICES</div>
        <h2 className="display t-h2">The kind of voice you&apos;ll hear.</h2>
        <p className="mt-3 text-[15px] text-secondary">
          Real supporters, not pundits. Named hosts show up here as rooms open.
        </p>
        <div className="mt-6 grid gap-3.5 md:grid-cols-3">
          {VOICES.map((v) => (
            <div
              key={v.t}
              className="rounded-2xl border border-line bg-surface p-6 transition-transform hover:-translate-y-[3px]"
            >
              <span
                className="mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-full font-bold text-white"
                style={{ background: v.grad }}
              >
                {v.i}
              </span>
              <div className="text-[18px] font-extrabold">{v.t}</div>
              <p className="mt-2 text-[14px] leading-[1.55] text-secondary">
                {v.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1010px] px-5 pb-14 sm:px-10">
        <div className={`${eyebrow} mb-3`}>QUESTIONS, ANSWERED</div>
        <h2 className="display t-h2">The bits people ask.</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {FAQ.map((f) => (
            <div
              key={f.q}
              className="rounded-[14px] border border-line bg-surface p-[22px]"
            >
              <div className="mb-[7px] text-[15px] font-bold">{f.q}</div>
              <p className="text-[13px] leading-[1.55] text-secondary">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-t border-line px-5 py-20 text-center sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 50%, rgba(239,1,7,.2), transparent 70%)",
          }}
        />
        <div className="relative z-[2]">
          <h2 className="display mx-auto t-hero">Pull up a seat.</h2>
          <p className="mx-auto mt-[18px] max-w-[500px] text-[17px] leading-[1.6] text-secondary">
            Jump in and listen along. Sign up when you want to chat, vote, or
            call in.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/matches"
              className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-[30px] py-4 text-[15px] font-semibold text-white"
            >
              See what&apos;s on →
              <span aria-hidden="true" className="btn-shine" />
            </Link>
            <Link
              href="/host"
              className="inline-flex items-center rounded-[13px] border border-line bg-surface/40 px-[26px] py-4 text-[15px] font-semibold text-primary hover:bg-raised"
            >
              Host a room
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
