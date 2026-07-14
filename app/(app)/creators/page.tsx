import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { Faq } from "@/components/marketing/Faq";

/**
 * /creators — marketing landing for podcasters and creators (not role-gated;
 * mirrors /about + HostLanding). Sells the capabilities that exist TODAY in any
 * room: live call-in shows, instant downloadable episodes, 100% ownership.
 * Honesty: no fabricated audience/reach numbers; facts are policy facts.
 * Compliance: the audio-only rule stays prominent (golden rule 1). Topic/anytime
 * rooms are framed as roadmap, not a shipped feature, until they land.
 */

export const metadata: Metadata = {
  title: "For creators",
  description: `Run live call-in shows, walk away with instant downloadable episodes, and own 100% of everything. ${brand.name} for podcasters and creators.`,
};

const eyebrow =
  "inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red";

const FACTS = [
  { n: "100%", l: "of every recording is yours", red: true },
  { n: "1 tap", l: "puts a listener on air", red: false },
  { n: "Instant", l: "downloadable episodes", red: false },
  { n: "£0", l: "to host your show", red: false },
];

const BENEFITS = [
  {
    t: "Live call-in shows",
    d: "Turn listeners into guests with one tap. A moderated queue, a host-plus-two-guests cap, private caller positions, and instant on-air — the phone-in, without the switchboard.",
  },
  {
    t: "Instant, downloadable episodes",
    d: "The second you wrap, your show is transcoded to a full MP3 and cut into per-segment files, zipped and ready to grab. No export dance, no waiting on a producer.",
  },
  {
    t: "You own all of it",
    d: `No license, no exclusivity, no cut of your content. Every recording is yours to publish anywhere. ${brand.name} just hands you the files.`,
  },
];

const FORMATS = [
  {
    t: "A live edition of your pod",
    d: "Record the show you already make, but with a room full of listeners reacting in real time.",
  },
  {
    t: "Listener call-in specials",
    d: "Open the lines for a phone-in — transfer window, big signings, post-match hot takes.",
  },
  {
    t: "Matchday watch-alongs",
    d: "Go live alongside the game and take the room's temperature minute by minute.",
  },
  {
    t: "Breakdowns & reactions",
    d: "Spin up a room the moment news drops and give your audience somewhere to land.",
  },
];

const FAQ = [
  {
    q: "What do I need to start?",
    a: "A phone or laptop and a reasonably quiet room. A cheap USB mic helps but isn't required. The whole thing runs in the browser, including iOS Safari — no app, no studio.",
  },
  {
    q: "Do my listeners have to pay?",
    a: "No. Listening and reading are always free, no account needed. Listeners can tip you if they want to, and tips go to you, minus only the payment processor's cut.",
  },
  {
    q: "Do I really keep my recordings?",
    a: "Yes — 100%. Every broadcast is recorded and cut into a full MP3 plus per-segment files you can download and republish anywhere. We take no license and no rights. Files stay available to download for 90 days (you can pin ones you want to keep longer).",
  },
  {
    q: "Can I run it under my own name and brand?",
    a: "Yes. It's your profile, your show name, your voice and guests. We're the room and the tools, not the marquee.",
  },
  {
    q: "Can I host a regular show?",
    a: "You can schedule a room for any time and share the link. Recurring shows and standing call-in slots are on the roadmap — the goal is a place your listeners know to find you, week in, week out.",
  },
  {
    q: "Is it only for match commentary?",
    a: `${brand.name} is built Arsenal-first and matchday is the heart of it, but a room is just a live audio space — bring whatever show you want to run.`,
  },
];

export default function CreatorsPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden px-5 pt-16 pb-10 sm:px-10">
        <div
          aria-hidden="true"
          className="animate-fc-glow pointer-events-none absolute -top-40 right-0 h-[560px] w-[760px]"
          style={{
            background:
              "radial-gradient(54% 56% at 60% 40%, rgba(239,1,7,.16), transparent 72%)",
          }}
        />
        <div className="relative z-[2] mx-auto max-w-[780px] text-center">
          <div className={`${eyebrow} justify-center`}>
            FOR PODCASTERS &amp; CREATORS
          </div>
          <h1 className="display mt-4 t-hero text-primary">
            Your show, live. Then downloadable.
          </h1>
          <p className="mx-auto mt-5 max-w-[600px] text-[18px] leading-[1.6] text-secondary">
            Bring your listeners into the room with live call-ins, then walk away
            with the whole episode cut and ready to download. Your voice, your
            guests, your show — {brand.name} just runs the room and hands you the
            files.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/host"
              className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-7 py-4 text-[15px] font-semibold text-white"
            >
              Start your first show <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/host/guide"
              className="inline-flex items-center gap-2 rounded-[13px] border border-line bg-surface/40 px-[26px] py-4 text-[15px] font-semibold text-primary transition-colors hover:bg-raised"
            >
              Read the handbook
            </Link>
          </div>
        </div>
      </section>

      {/* FACT BAND */}
      <section className="border-y border-line px-5 py-9 sm:px-10">
        <div className="mx-auto grid max-w-[1010px] grid-cols-2 md:grid-cols-4">
          {FACTS.map((s, i) => (
            <div
              key={s.l}
              className={`px-5 py-2 text-center ${i > 0 ? "md:border-l md:border-line" : ""}`}
            >
              <div
                className={`display text-[40px] ${s.red ? "text-red" : "text-primary"}`}
              >
                {s.n}
              </div>
              <div className="mt-1 text-[13px] text-secondary">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CORE BENEFITS */}
      <section className="mx-auto max-w-[1010px] px-5 pt-14 pb-2 sm:px-10">
        <div className={`${eyebrow} mb-3`}>WHY CREATORS HOST HERE</div>
        <h2 className="display max-w-[680px] t-h2">
          More than a mic. A live audience and a finished episode.
        </h2>
        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div
              key={b.t}
              className="rounded-2xl border border-line bg-raised px-6 pt-[26px] pb-7 shadow-card"
            >
              <h3 className="t-title font-extrabold">{b.t}</h3>
              <p className="mt-2.5 text-[13.5px] leading-[1.55] text-secondary">
                {b.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FORMATS / DIVERSIFY */}
      <section className="mx-auto max-w-[1010px] px-5 pt-14 pb-2 sm:px-10">
        <div className={`${eyebrow} mb-3`}>NEW FORMATS</div>
        <h2 className="display max-w-[680px] t-h2">
          A live dimension your feed can&apos;t offer.
        </h2>
        <p className="mt-4 max-w-[620px] text-[15px] leading-[1.6] text-secondary">
          The same show you already make, plus a room that talks back. Give
          listeners a reason to show up live — and a reason to come back.
        </p>
        <div className="mt-8 grid gap-[18px] sm:grid-cols-2">
          {FORMATS.map((f) => (
            <div
              key={f.t}
              className="rounded-2xl border border-line bg-surface px-6 py-6"
            >
              <h3 className="t-title font-extrabold">{f.t}</h3>
              <p className="mt-2 text-sm leading-[1.55] text-secondary">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THE ONE RULE — audio only (load-bearing compliance) */}
      <section className="mx-auto max-w-[1010px] px-5 pt-12 pb-5 sm:px-10">
        <div className="rounded-2xl border border-red/30 bg-inset px-6 py-7">
          <div className={`${eyebrow} mb-3`}>THE ONE RULE</div>
          <h3 className="display t-h3">Audio only, always</h3>
          <p className="mt-2 mb-5 max-w-[680px] text-sm leading-[1.6] text-secondary">
            Your show is your voice and your guests. Never play match video or
            broadcast audio through it, even in the background. That rule is what
            keeps you — and the platform — on the right side of the line, and it
            is the one thing we can&apos;t bend.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
              style={{
                background: "rgba(52,209,122,.08)",
                borderColor: "rgba(52,209,122,.3)",
              }}
            >
              <span className="text-lg font-extrabold text-green">✓</span>
              <span className="text-[13.5px] font-semibold text-primary">
                Your voice, your guests, your takes
              </span>
            </div>
            <div
              className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
              style={{
                background: "rgba(239,1,7,.06)",
                borderColor: "rgba(239,1,7,.3)",
              }}
            >
              <span className="text-lg font-extrabold text-red">✗</span>
              <span className="text-[13.5px] font-semibold text-primary">
                Match video or broadcast audio, ever
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[760px] px-5 pt-8 pb-4 sm:px-10">
        <div className={`${eyebrow} mb-3.5`}>QUICK ANSWERS</div>
        <h2 className="display t-h2">What creators ask</h2>
        <Faq items={FAQ} />
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-t border-line px-5 py-16 text-center sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 h-[460px] w-[860px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 50%, rgba(239,1,7,.18), transparent 70%)",
          }}
        />
        <div className="relative z-[2]">
          <h2 className="display mx-auto t-h2">Put your listeners on air.</h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[16px] text-secondary">
            Set up a room in about a minute. Take call-ins, run your show, and
            download the whole thing when you&apos;re done. It&apos;s yours.
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href="/host"
              className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-7 py-4 text-[15px] font-semibold text-white"
            >
              Start your first show <span aria-hidden="true">→</span>
              <span aria-hidden="true" className="btn-shine" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
