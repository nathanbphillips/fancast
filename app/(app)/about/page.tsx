import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

/**
 * About / Voices (Programme design): manifesto hero, problem/idea/promise ruled
 * cards, stat band, four principles, founder boxed panel, the voices
 * (archetypes), FAQ as ruled rows, CTA. Copy verbatim (no em dashes). The
 * compliance FAQ stays prominent. Voices are illustrative archetypes; no
 * photos, no fabricated follower counts.
 */

export const metadata: Metadata = {
  title: "About",
  description: `What ${brand.name} is setting out to build, how a matchday works, and why it's fans in your ear instead of pundits.`,
};

const eyebrow =
  "inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red";

const STORY = [
  {
    h: "THE PROBLEM",
    p: "Pundits hedge. Streams lag. The group chat moves too fast to read. Watching with other fans got harder, not easier, and nobody's on your side for the whole game.",
  },
  {
    h: "THE IDEA",
    p: "Keep your own stream. Add a live fan host, a chat worth reading, and the stats on tap, all synced to your screen with one tap. We don't show the game; we sit beside it.",
  },
  {
    h: "WHAT WE'RE BUILDING",
    p: "A place that stays independent and unofficial, where hosts keep and own every recording. Built for supporters, never for rights-holders.",
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
    grad: "var(--red-fill)",
    t: "The lifelong Gooner",
    d: "Lives and dies with every result and calls it exactly as they see it. Never neutral, never on the fence.",
  },
  {
    i: "TH",
    grad: "#1f6f4a",
    t: "The tactics head",
    d: "Will talk you through the xG and the press triggers, then happily ignore all of it the second we score a wonder goal.",
  },
  {
    i: "CH",
    grad: "#2a4a8a",
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
      <section className="relative px-5 pt-[70px] pb-12 text-center sm:px-10">
        <div className="relative z-[2] mx-auto max-w-[820px]">
          <span className={`${eyebrow} justify-center`}>
            About {brand.name}
          </span>
          <h1 className="display mt-6 t-hero">
            Not a broadcaster.
            <br />
            Fans &amp; friends,{" "}
            <span className="text-red">hanging out</span>.
          </h1>
          <p className="mx-auto mt-[22px] max-w-[600px] text-[18px] leading-[1.62] text-secondary italic">
            Match coverage got polished into something that forgot who it was
            for. We&apos;re setting out to build the opposite: a real supporter in
            your ear, the chat you&apos;d have at the pub, and the numbers that
            actually matter, riding alongside whatever stream you already watch.
            It&apos;s early, and we&apos;re building it in the open.
          </p>
        </div>
      </section>

      {/* PROBLEM / IDEA / PROMISE */}
      <section className="mx-auto max-w-[1010px] px-5 pb-5 sm:px-10">
        <div className="grid gap-3 md:grid-cols-3">
          {STORY.map((s) => (
            <div
              key={s.h}
              className="border border-line border-t-2 border-t-red bg-canvas p-[26px]"
            >
              <div className="mb-3 font-mono text-[11px] tracking-[0.08em] text-red">
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
        <h2 className="display border-b-[3px] border-double border-primary pb-4 t-h2">
          Four things we won&apos;t budge on.
        </h2>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <div
              key={p.k}
              className="flex gap-[18px] border border-line bg-canvas p-[26px]"
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
        <div className="relative grid items-center gap-8 border-2 border-primary bg-canvas p-9 sm:grid-cols-[auto_1fr]">
          <div className="relative z-[2] text-center">
            <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-fill font-mono text-[34px] font-extrabold text-on-red">
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
              className="inline-flex items-center gap-2 border-2 border-primary px-[18px] py-[11px] font-mono text-[13px] font-semibold tracking-[0.08em] text-primary transition-colors hover:text-red"
            >
              Say hello on Bluesky →
            </a>
          </div>
        </div>
      </section>

      {/* THE VOICES */}
      <section className="mx-auto max-w-[1010px] px-5 pb-14 sm:px-10">
        <div className={`${eyebrow} mb-3`}>THE VOICES</div>
        <h2 className="display border-b-[3px] border-double border-primary pb-4 t-h2">
          The kind of voice you&apos;ll hear.
        </h2>
        <p className="mt-3 text-[15px] text-secondary italic">
          Real supporters, not pundits. Named hosts show up here as rooms open.
        </p>
        <div className="mt-6 grid gap-3.5 md:grid-cols-3">
          {VOICES.map((v) => (
            <div
              key={v.t}
              className="border border-line bg-canvas p-6"
            >
              <span
                className="mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-full font-bold text-on-red"
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
        <h2 className="display border-b-[3px] border-double border-primary pb-4 t-h2">
          The bits people ask.
        </h2>
        <div className="mt-4 border-b border-line">
          {FAQ.map((f) => (
            <div
              key={f.q}
              className="border-t border-line py-5 first:border-t-0"
            >
              <div className="mb-[7px] text-[15px] font-bold">{f.q}</div>
              <p className="text-[13px] leading-[1.55] text-secondary">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* GET ON THE MIC — host + creators CTAs */}
      <section className="mx-auto max-w-[1010px] px-5 pb-14 sm:px-10">
        <div className={`${eyebrow} mb-3`}>WANT TO HOST?</div>
        <h2 className="display border-b-[3px] border-double border-primary pb-4 t-h2">
          Two ways to get on the mic.
        </h2>
        <p className="mt-3 max-w-[560px] text-[15px] text-secondary italic">
          We&apos;re looking for the fans and creators who want to build this
          with us. If that&apos;s you, there&apos;s a seat at the front.
        </p>
        <div className="mt-6 grid gap-3.5 md:grid-cols-2">
          <div className="flex flex-col border border-line bg-canvas p-7">
            <h3 className="text-[19px] font-extrabold tracking-[-0.01em]">
              Host a matchday room
            </h3>
            <p className="mt-2 flex-1 text-[14px] leading-[1.6] text-secondary">
              Know the club and can hold a mic? Open a room for a game, bring the
              chat and the call-ins, and keep every recording.
            </p>
            <Link
              href="/host"
              className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-red transition-opacity hover:opacity-80"
            >
              For hosts →
            </Link>
          </div>
          <div className="flex flex-col border border-line bg-canvas p-7">
            <h3 className="text-[19px] font-extrabold tracking-[-0.01em]">
              Bring your podcast
            </h3>
            <p className="mt-2 flex-1 text-[14px] leading-[1.6] text-secondary">
              Run a live call-in show, then walk away with the whole episode cut
              and ready to download. Your show, your guests, one hundred percent
              yours.
            </p>
            <Link
              href="/creators"
              className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-red transition-opacity hover:opacity-80"
            >
              For creators →
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative border-t-[3px] border-double border-primary px-5 py-20 text-center sm:px-10">
        <div className="relative z-[2]">
          <h2 className="display mx-auto t-hero">Pull up a seat.</h2>
          <p className="mx-auto mt-[18px] max-w-[500px] text-[17px] leading-[1.6] text-secondary">
            Jump in and listen along. Sign up when you want to chat, vote, or
            call in.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/matches"
              className="btn-grad-red inline-flex items-center gap-2 px-[30px] py-4 text-[15px] font-semibold"
            >
              See what&apos;s on →
            </Link>
            <Link
              href="/host"
              className="inline-flex items-center border-2 border-primary px-[26px] py-4 font-mono text-[14px] font-semibold tracking-[0.08em] text-primary hover:text-red"
            >
              Host a room
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
