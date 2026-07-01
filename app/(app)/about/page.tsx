import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { Faq } from "@/components/marketing/Faq";

export const metadata: Metadata = {
  title: "About",
  description: `What ${brand.name} is, how a matchday works, and why it's the matchday company you've been missing.`,
};

const STORY = [
  {
    h: "The problem",
    p: "Watching alone is quiet. The group chat lags two minutes behind the action, your mates are scattered across five apps, and the official feeds are polished, neutral and a little bit lifeless.",
  },
  {
    h: "The idea",
    p: "Put the people, the takes and the stats in one room — a fellow Gooner calling the game in your ear while everyone reacts in real time. All riding alongside the match you're already watching.",
  },
  {
    h: "The promise",
    p: "We never show the match, we don't pretend to be impartial, and the hosts own every second they broadcast. Fan-first, on purpose — the pub for fans who don't have one.",
  },
];

const STATS = [
  { n: "Arsenal", c: "the club we start with" },
  { n: "<500ms", c: "live audio latency" },
  { n: "100%", c: "of each show owned by its host" },
  { n: "£0", c: "to listen — no account needed" },
];

const PRINCIPLES = [
  {
    t: "We don't show the match",
    d: `${brand.name} is audio, chat and stats only — never the broadcast. You bring your own lawful way of watching; we just keep you company.`,
  },
  {
    t: "Unofficial, and proud of it",
    d: "A fan-made platform, not affiliated with or endorsed by any club, league or broadcaster. Your host is a fan, not an official analyst.",
  },
  {
    t: "Your recordings are yours",
    d: "Hosts own their broadcasts outright. The platform takes no cut of the rights and no exclusivity.",
  },
  {
    t: "You can just listen",
    d: "No account, no paywall, no pressure. Sign up only if and when you want to join in.",
  },
];

const HOSTS = [
  {
    name: "The lifer",
    handle: "season ticket since '04",
    bio: "Lives and dies with every result. Will not be neutral about anything — and you wouldn't want them to be.",
  },
  {
    name: "The tactician",
    handle: "diagrams optional",
    bio: "Reads the game two passes ahead and tells you why the press just broke — without the pundit clichés.",
  },
  {
    name: "The joker",
    handle: "keeps it light",
    bio: "Turns a nervy 0–0 into the best 90 minutes of your week. The mate you actually want next to you.",
  },
];

const FAQ = [
  {
    q: "Do you stream the match?",
    a: `No — and we never will. ${brand.name} doesn't show match video or play broadcast audio. You watch the game however you already legally do, and we ride alongside with fan commentary, chat and stats.`,
  },
  {
    q: "Is this official Arsenal?",
    a: `No. ${brand.name} is an unofficial, fan-made platform and isn't affiliated with or endorsed by Arsenal, the Premier League, or any broadcaster. The hosts are fans, not official club analysts.`,
  },
  {
    q: "Do I need to pay or sign up?",
    a: "No. Anyone can listen and read the chat and stats without an account. You only sign up — under a minute — when you want to chat, vote, ask a question or call in.",
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
    a: "Yes, if you want to. You can request the mic, and with the host's consent you go live to the room. It's recorded as part of the show — and if you'd rather just listen, you never have to.",
  },
  {
    q: "What about the recordings?",
    a: `Each broadcast is saved as downloadable segments. They belong to the host completely; ${brand.name} claims no rights and asks for nothing.`,
  },
  {
    q: "Is it only Arsenal?",
    a: "For now, yes — we're starting with Arsenal and doing it properly. More clubs will follow.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1180px] px-5 sm:px-10">
      {/* MANIFESTO */}
      <section className="py-16 sm:py-20">
        <Eyebrow>About {brand.name}</Eyebrow>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[0.98] sm:text-7xl">
          Not a broadcaster.{" "}
          <span
            className="text-red"
            style={{ textShadow: "0 0 32px rgba(241,35,43,0.5)" }}
          >
            Fans &amp; friends hanging out.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-secondary sm:text-xl">
          Football&apos;s better with people. {brand.name} is the live room where
          a fellow Gooner calls the game in your ear while everyone argues,
          celebrates and suffers together — all alongside the match you&apos;re
          already watching.
        </p>
      </section>

      {/* STORY */}
      <section className="grid gap-10 border-t border-line py-16 sm:grid-cols-3">
        {STORY.map((s) => (
          <div key={s.h}>
            <h2 className="font-display text-2xl text-gold">{s.h}</h2>
            <p className="mt-3 text-secondary">{s.p}</p>
          </div>
        ))}
      </section>

      {/* STATS BAND */}
      <section className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.c} className="bg-canvas p-7">
            <p className="font-display text-4xl text-gold">{s.n}</p>
            <p className="mt-1 text-sm text-secondary">{s.c}</p>
          </div>
        ))}
      </section>

      {/* PRINCIPLES */}
      <section className="py-16">
        <Eyebrow>What we stand for</Eyebrow>
        <h2 className="mt-3 font-display text-4xl sm:text-5xl">
          Four things we won&apos;t budge on
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <div
              key={p.t}
              className="flex gap-5 rounded-2xl border border-line bg-surface p-6"
            >
              <span className="font-display text-3xl text-gold tabular-nums">
                0{i + 1}
              </span>
              <div>
                <h3 className="font-display text-xl">{p.t}</h3>
                <p className="mt-2 text-sm text-secondary">{p.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOSTS */}
      <section className="border-t border-line py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>The voices</Eyebrow>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl">
              The kind of voices you&apos;ll hear
            </h2>
          </div>
          <p className="max-w-[240px] font-mono text-[11px] tracking-wide text-secondary uppercase">
            Real hosts, once the rooms open. These are the types.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {HOSTS.map((h) => (
            <div
              key={h.name}
              className="overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <div
                className="relative flex h-32 items-end p-5"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(241,35,43,0.18), rgba(232,181,74,0.12))",
                }}
              >
                <span
                  aria-hidden="true"
                  className="h-12 w-12 rounded-full border-2 border-surface"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 30%, #f1232b, #7a0f14)",
                  }}
                />
              </div>
              <div className="p-5">
                <p className="font-display text-lg">{h.name}</p>
                <p className="font-mono text-[11px] text-gold">{h.handle}</p>
                <p className="mt-2 text-sm text-secondary">{h.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line py-16">
        <Eyebrow>Questions, answered</Eyebrow>
        <h2 className="mt-3 font-display text-4xl sm:text-5xl">The bits people ask</h2>
        <Faq items={FAQ} />
      </section>

      {/* CTA */}
      <section className="border-t border-line py-20 text-center">
        <h2 className="mx-auto max-w-2xl font-display text-5xl sm:text-6xl">
          Pull up a seat.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-secondary">
          There&apos;s a match coming. Come watch it with people who care as much
          as you do.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button href="/matches">See what&apos;s live →</Button>
          <Button href="/" variant="outline">
            Back to home
          </Button>
        </div>
      </section>
    </div>
  );
}
