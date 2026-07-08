import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { Faq } from "@/components/marketing/Faq";

/**
 * About / Voices (Matchday redesign): manifesto hero → story → stat band →
 * principles → maker → the voices (archetypes) → FAQ → CTA. Copy verbatim (no
 * em-dashes). The compliance FAQ is kept prominent per the founder's decision
 * log. Voices are illustrative archetypes; no real photos, no fabricated
 * follower counts (hybrid-honesty rule).
 */

export const metadata: Metadata = {
  title: "Voices",
  description: `What ${brand.name} is, how a matchday works, and why it's fans in your ear instead of pundits.`,
};

const eyebrow =
  "inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red";

const STORY = [
  {
    h: "The problem",
    p: "Pundits hedge. Streams lag. The group chat moves too fast to read. Watching with other fans got harder, not easier, and nobody's on your side for the full ninety.",
  },
  {
    h: "The idea",
    p: "Keep your own stream. Add a live fan host, a chat worth reading, and the stats on tap, all synced to your screen with one tap. We don't show the game; we sit beside it.",
  },
  {
    h: "The promise",
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
    d: "Every room is hosted by a supporter who actually cares about the result. No neutral takes, no broadcast script. Just someone on your side.",
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

const HOSTS = [
  {
    role: "The lifelong Gooner",
    bio: "Lives and dies with every result and calls it exactly like they see it. Never neutral, never on the fence.",
  },
  {
    role: "The tactics head",
    bio: "Will talk you through the xG and the press triggers, then happily ignore all of it the second we score a worldie.",
  },
  {
    role: "The call-in host",
    bio: "Runs the half-time poll and the call-in mic on the big nights, so the whole room gets a say.",
  },
];

const FAQ = [
  {
    q: "Do you stream the match?",
    a: `No, and we never will. ${brand.name} doesn't show match video or play broadcast audio. You watch the game however you already legally do, and we ride alongside with fan commentary, chat and stats.`,
  },
  {
    q: "Is this official Arsenal?",
    a: `No. ${brand.name} is an unofficial, fan-made platform and isn't affiliated with or endorsed by Arsenal, the Premier League, or any broadcaster. The hosts are fans, not official club analysts.`,
  },
  {
    q: "Do I need to pay or sign up?",
    a: "No. Anyone can listen and read the chat and stats without an account. You only sign up, in under a minute, when you want to chat, vote, ask a question or call in.",
  },
  {
    q: "How does the sync work?",
    a: "A reference match-clock ticks on screen. When your own feed shows that exact moment, you tap Now and the commentary lines up to your screen. Half-second steppers fine-tune it, and you can jump back to live whenever.",
  },
  {
    q: "Does it work on my iPhone?",
    a: `Yes. ${brand.name} runs in the browser including iOS Safari, installs to your home screen, and keeps playing audio on the lock screen like a radio.`,
  },
  {
    q: "Can I talk on air?",
    a: "Yes, if you want to. You can request the mic, and with the host's consent you go live to the room. It's recorded as part of the show. And if you'd rather just listen, you never have to.",
  },
  {
    q: "What about the recordings?",
    a: `Each broadcast is saved as downloadable segments. They belong to the host completely; ${brand.name} claims no rights and asks for nothing.`,
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
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(120% 90% at 15% -20%, rgba(239,1,7,0.18), transparent 56%), var(--bg-base)",
        }}
      >
        <div className="relative mx-auto max-w-[1120px] px-5 py-16 sm:px-10 sm:py-[70px]">
          <div className={`${eyebrow} mb-5`}>THE VOICES · {brand.name.toUpperCase()}</div>
          <h1 className="display max-w-[900px] t-hero">
            Not a broadcaster.
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(120deg,#ff2e28,#ef0107 55%,#b00206)",
              }}
            >
              Fans &amp; friends hanging out.
            </span>
          </h1>
          <p className="mt-6 max-w-[640px] text-lg leading-[1.55] text-secondary sm:text-xl">
            Match coverage got polished into something that forgot who it was
            for. {brand.name} is the opposite: a real supporter in your ear, the
            chat you&apos;d have at the pub, and the numbers that actually matter,
            riding alongside whatever stream you already watch.
          </p>
        </div>
      </section>

      {/* STORY */}
      <section className="mx-auto grid max-w-[1120px] gap-8 px-5 pt-12 pb-6 sm:grid-cols-3 sm:px-10">
        {STORY.map((s) => (
          <div key={s.h}>
            <p className="display mb-3.5 t-h3 text-red">{s.h}</p>
            <p className="text-[15px] leading-[1.6] text-secondary">{s.p}</p>
          </div>
        ))}
      </section>

      {/* STAT BAND */}
      <section className="mx-auto max-w-[1120px] px-5 pt-12 pb-6 sm:px-10">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.c} className="bg-inset px-6 py-7">
              <p
                className={`display text-[46px] leading-none ${s.red ? "text-red" : "text-primary"}`}
              >
                {s.n}
              </p>
              <p className="mt-2 text-[13px] text-secondary">{s.c}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="mx-auto max-w-[1120px] px-5 pt-12 pb-6 sm:px-10">
        <div className={`${eyebrow} mb-3.5`}>WHAT WE STAND FOR</div>
        <h2 className="display t-h2">Four things we won&apos;t budge on</h2>
        <div className="mt-8 grid gap-[18px] sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <div
              key={p.k}
              className="flex gap-[18px] rounded-2xl border border-line bg-raised px-[26px] pt-[26px] pb-7 shadow-card"
            >
              <span className="display text-[34px] leading-[0.9] text-red">
                0{i + 1}
              </span>
              <div>
                <h3 className="t-title font-extrabold">{p.k}</h3>
                <p className="mt-2 text-sm leading-[1.55] text-secondary">
                  {p.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MAKER */}
      <section className="mx-auto max-w-[1120px] px-5 pt-12 pb-6 sm:px-10">
        <div className="rounded-2xl border border-line bg-raised px-6 py-8 sm:px-9 sm:py-10">
          <div className={`${eyebrow} mb-3.5`}>WHO&apos;S BEHIND IT</div>
          <h2 className="display t-h2">Made by a fan, not a media company</h2>
          <div className="mt-5 max-w-[680px] space-y-4 text-[15px] leading-[1.6] text-secondary">
            <p>
              {brand.name} is built by Nathan Phillips, an Arsenal supporter who
              grew up in Detroit and adopted a team in North London the way
              plenty of us did: from afar, at odd hours, often on the sofa alone.
              Watching with pundits who did not care about the result stopped
              being fun, so this is the room he wanted to watch in.
            </p>
            <p>
              It is early and it is independent, built in the open rather than
              behind a press release. If you have a thought, a bug, or a club you
              want to see next, the door is open.
            </p>
          </div>
          <a
            href="https://bsky.app/profile/nathanphillips.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-red hover:underline"
          >
            Say hello on Bluesky <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      {/* THE VOICES */}
      <section className="mx-auto max-w-[1120px] px-5 pt-12 pb-6 sm:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className={`${eyebrow} mb-3.5`}>THE VOICES</div>
            <h2 className="display t-h2">The kind of voice you&apos;ll hear</h2>
          </div>
          <p className="max-w-[240px] text-right font-mono text-[11px] leading-[1.5] text-tertiary">
            Real supporters, not pundits. Named hosts show up here as rooms open.
          </p>
        </div>
        <div className="grid gap-[18px] sm:grid-cols-3">
          {HOSTS.map((h, i) => (
            <div
              key={h.role}
              className="overflow-hidden rounded-2xl border border-line bg-raised"
            >
              <div
                className="relative flex h-[130px] items-end p-3.5"
                style={{
                  background:
                    "radial-gradient(80% 90% at 50% 0%, rgba(239,1,7,0.16), transparent 62%), var(--bg-inset)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="relative h-14 w-14 rounded-full border-2 border-raised"
                  style={{
                    background:
                      i === 1
                        ? "linear-gradient(135deg,#1f6f4a,#0c3a26)"
                        : i === 2
                          ? "linear-gradient(135deg,#2a4a8a,#12224a)"
                          : "linear-gradient(135deg,#ef0107,#7a0a12)",
                  }}
                />
              </div>
              <div className="px-5 pt-[18px] pb-[22px]">
                <h3 className="mb-1.5 t-title font-extrabold">{h.role}</h3>
                <p className="text-[13.5px] leading-[1.5] text-secondary">
                  {h.bio}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ (kept for compliance) */}
      <section className="mx-auto max-w-[1120px] px-5 pt-12 pb-12 sm:px-10">
        <div className={`${eyebrow} mb-3.5`}>QUESTIONS, ANSWERED</div>
        <h2 className="display t-h2">The bits people ask</h2>
        <Faq items={FAQ} />
      </section>

      {/* CTA */}
      <section
        className="relative overflow-hidden border-t border-line"
        style={{
          background:
            "radial-gradient(90% 130% at 50% 120%, rgba(239,1,7,0.28), transparent 60%), var(--bg-base)",
        }}
      >
        <div className="relative mx-auto max-w-[1120px] px-5 py-20 text-center sm:px-10">
          <h2 className="display mx-auto max-w-2xl t-hero">Pull up a seat.</h2>
          <p className="mx-auto mt-4 max-w-[460px] text-[17px] text-secondary">
            Jump in and listen along. Sign up when you want to chat, vote, or
            call in.
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href="/matches"
              className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-7 py-4 text-[15px] font-semibold text-white"
            >
              See what&apos;s on <span aria-hidden="true">→</span>
              <span aria-hidden="true" className="btn-shine" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
