import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { Faq } from "@/components/marketing/Faq";

/**
 * About (Cloud Design "1a"): manifesto hero → story 3-col → stat band →
 * principles → hosts → FAQ → CTA. Copy is verbatim from the design (no
 * em-dashes). The compliance FAQ is kept per the founder's decision log
 * ("explicit 'we don't show the match' + FAQ kept prominent"). Hosts are
 * illustrative personas; no real photos (abstract marks only).
 */

export const metadata: Metadata = {
  title: "About",
  description: `What ${brand.name} is, how a matchday works, and why it's fans in your ear instead of pundits.`,
};

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
  { n: "0", c: "pundits on the payroll", gold: true },
  { n: "100%", c: "of recordings owned by hosts" },
  { n: "<1min", c: "to sign up and join in" },
  { n: "90", c: "minutes live, every match" },
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
    name: "nathan",
    handle: "@n8_afc",
    bio: "A Gooner since the Highbury days. Calls it like he sees it.",
  },
  {
    name: "priya",
    handle: "@priyagooner",
    bio: "Tactics head. Will explain the xG and then ignore it when we score a worldie.",
  },
  {
    name: "deniz",
    handle: "@denizN5",
    bio: "Half-time poll enforcer. Runs the call-in mic on big nights.",
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

const stripe =
  "repeating-linear-gradient(135deg, var(--bg2), var(--bg2) 9px, var(--bg-raised) 9px, var(--bg-raised) 18px)";

export default function AboutPage() {
  return (
    <>
      {/* MANIFESTO HERO */}
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(120% 90% at 15% -20%, rgba(241,35,43,0.18), transparent 56%), var(--bg-base)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--hair) / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--hair) / 0.04) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            maskImage:
              "radial-gradient(120% 100% at 20% 0%, black, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(120% 100% at 20% 0%, black, transparent 72%)",
          }}
        />
        <div className="relative mx-auto max-w-[1180px] px-5 py-16 sm:px-10 sm:py-[70px]">
          <p className="mb-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
            About {brand.name}
          </p>
          <h1 className="display max-w-[900px] text-5xl leading-[0.92] sm:text-[74px]">
            Not a broadcaster.
            <br />
            <span
              className="text-red"
              style={{ textShadow: "0 0 38px rgba(241,35,43,0.5)" }}
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
      <section className="mx-auto grid max-w-[1180px] gap-8 px-5 pt-14 pb-5 sm:grid-cols-3 sm:px-10">
        {STORY.map((s) => (
          <div key={s.h}>
            <p className="display mb-3.5 text-3xl text-gold">{s.h}</p>
            <p className="text-[15px] leading-[1.6] text-secondary">{s.p}</p>
          </div>
        ))}
      </section>

      {/* STAT BAND */}
      <section className="mx-auto max-w-[1180px] px-5 pt-10 pb-2 sm:px-10">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.c} className="bg-inset px-6 py-7">
              <p className={`display text-[46px] leading-none ${s.gold ? "text-gold" : ""}`}>
                {s.n}
              </p>
              <p className="mt-2 text-[13px] text-secondary">{s.c}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="mx-auto max-w-[1180px] px-5 pt-14 pb-5 sm:px-10">
        <p className="mb-3.5 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
          What we stand for
        </p>
        <h2 className="display text-4xl leading-[0.95] sm:text-5xl">
          Four things we won&apos;t budge on
        </h2>
        <div className="mt-8 grid gap-[18px] sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <div
              key={p.k}
              className="flex gap-[18px] rounded-2xl border border-line bg-surface px-[26px] pt-[26px] pb-7"
            >
              <span className="display text-[34px] leading-[0.9] text-gold/90">
                0{i + 1}
              </span>
              <div>
                <h3 className="text-[19px] font-extrabold tracking-[-0.01em]">
                  {p.k}
                </h3>
                <p className="mt-2 text-sm leading-[1.55] text-secondary">
                  {p.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOSTS */}
      <section className="mx-auto max-w-[1180px] px-5 pt-12 pb-7 sm:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3.5 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
              The voices
            </p>
            <h2 className="display text-4xl leading-[0.95] sm:text-5xl">
              Your hosts
            </h2>
          </div>
          <p className="max-w-[240px] text-right font-mono text-[11px] leading-[1.5] text-secondary">
            Illustrative line-up. Real hosts appear here as rooms open.
          </p>
        </div>
        <div className="grid gap-[18px] sm:grid-cols-3">
          {HOSTS.map((h) => (
            <div
              key={h.handle}
              className="overflow-hidden rounded-2xl border border-line bg-inset"
            >
              <div
                className="relative flex h-[150px] items-end p-3.5"
                style={{ background: stripe }}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(80% 80% at 50% 0%, rgba(232,181,74,0.18), transparent 60%)",
                  }}
                />
                <span
                  aria-hidden="true"
                  className="relative h-14 w-14 rounded-full border-2 border-inset"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #3a3a40, #1b1b1f)",
                  }}
                />
              </div>
              <div className="px-5 pt-[18px] pb-[22px]">
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="text-[17px] font-extrabold">{h.name}</span>
                  <span className="font-mono text-[11px] text-gold">
                    {h.handle}
                  </span>
                </div>
                <p className="text-[13.5px] leading-[1.5] text-secondary">
                  {h.bio}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ (kept for compliance) */}
      <section className="mx-auto max-w-[1180px] px-5 pt-8 pb-14 sm:px-10">
        <p className="mb-3.5 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
          Questions, answered
        </p>
        <h2 className="display text-4xl leading-[0.95] sm:text-5xl">
          The bits people ask
        </h2>
        <Faq items={FAQ} />
      </section>

      {/* CTA */}
      <section
        className="relative overflow-hidden border-t border-line"
        style={{
          background:
            "radial-gradient(90% 130% at 50% 120%, rgba(241,35,43,0.28), transparent 60%), var(--bg-base)",
        }}
      >
        <div className="relative mx-auto max-w-[1180px] px-5 py-20 text-center sm:px-10">
          <h2 className="display mx-auto max-w-2xl text-5xl leading-[0.92] sm:text-[56px]">
            Pull up a seat.
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] text-[17px] text-secondary">
            Jump in and listen along. Sign up when you want to chat, vote, or
            call in.
          </p>
          <div className="mt-7 flex justify-center">
            <a
              href="/matches"
              className="inline-flex items-center gap-2.5 rounded-xl bg-red px-7 py-4 text-base font-bold text-white transition-colors hover:bg-red-hover"
              style={{ boxShadow: "0 16px 40px -10px rgba(241,35,43,0.7)" }}
            >
              See what&apos;s live <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
