import Link from "next/link";
import { brand } from "@/lib/brand";
import { Faq } from "@/components/marketing/Faq";
import { HeroProductShot } from "@/components/marketing/HeroProductShot";

/**
 * Marketing host-landing (Matchday redesign): the supply-side pitch shown at
 * /host to anyone who isn't yet a commentator (signed-out or listener).
 * Commentators get the dashboard instead. The single home for the host story.
 * Compliance: the "audio only" rule is the load-bearing one and stays prominent.
 * Honesty: ownership/fee/co-host figures are policy facts, not fabricated counts.
 */

const eyebrow =
  "inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red";

const OWNERSHIP = [
  { n: "100%", l: "of every recording is yours", red: true },
  { n: "£0", l: "platform fee to host", red: false },
  { n: "2", l: "equal co-hosts, no primary", red: false },
  { n: "<1min", l: "from account to on air", red: false },
];

const HOST_STEPS = [
  {
    n: "01",
    t: "Become a commentator",
    d: "Any account can upgrade from settings: read the terms, tick the box, and you can host today. No application, no waiting.",
  },
  {
    n: "02",
    t: "Create a room",
    d: "Pick an upcoming fixture and set two things: when your show starts (it defaults to fifteen minutes before kickoff) and an optional one-line blurb. Not in the list? Create your own room for any game from a title and a start time, now or later. Either way your room gets a clean, shareable link.",
  },
  {
    n: "03",
    t: "Host a whole season",
    d: "One click schedules a room for every game your team plays this season, and new fixtures get their room automatically as they appear.",
  },
  {
    n: "04",
    t: "Bring a co-host",
    d: "Invite another commentator to share the room as an equal. Either of you can run everything, both of you appear on the room, and both of you keep the recordings.",
  },
  {
    n: "05",
    t: "Go on air",
    d: "Open the waiting room, start the broadcast, run the clock, moderate the chat, take call-ins, and push stats. Your listeners are with you the whole way.",
  },
  {
    n: "06",
    t: "Keep your show",
    d: `Every broadcast is recorded and cut into downloadable segments. You own them, one hundred percent. ${brand.name} takes no license, no exclusivity, nothing.`,
  },
];

const PROMISES = [
  {
    k: "You own 100%",
    d: "Every recording is yours. We take no license and no cut of it.",
  },
  {
    k: "No platform fee to host",
    d: "Hosting a room is free. Tips go to you, minus only payment costs.",
  },
  {
    k: "Equal co-hosts",
    d: "Share a room with another supporter. No primary, both keep the recordings.",
  },
];

const HOST_FAQ = [
  {
    q: "What gear do I need?",
    a: "Just a phone or laptop and a reasonably quiet room. A cheap USB mic helps but isn't required. You run the whole show from the browser, including iOS Safari.",
  },
  {
    q: "Do my listeners have to pay?",
    a: "No. Listening and reading are always free, with no account needed. Listeners can tip you if they want to, and tips go to you, minus only the payment processor's cut.",
  },
  {
    q: "What if the game isn't listed?",
    a: "Create your own room for any match from a title and a start time, now or later. We're adding more competitions as fast as we can, and you can request one from the create screen.",
  },
  {
    q: "What if something breaks mid-show?",
    a: "Your recording keeps going and is cut into segments regardless. If you drop off, reopen the room and pick straight back up. Ending or losing a call is neutral, with no effect on anyone's standing.",
  },
];

export function HostLanding({
  ctaHref,
  ctaLabel,
  note,
}: {
  ctaHref: string;
  ctaLabel: string;
  /** small line under the CTA, e.g. an already-a-commentator hint */
  note?: string;
}) {
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
        <div className="relative z-[2] mx-auto max-w-[760px] text-center">
          <div className={`${eyebrow} justify-center`}>FOR COMMENTATORS</div>
          <h1 className="display mt-4 t-hero text-primary">
            Hold a mic. Host the room.
          </h1>
          <p className="mx-auto mt-5 max-w-[580px] text-[18px] leading-[1.6] text-secondary">
            If you know the club and you can hold a mic, there is a seat for you
            at the front. Setting up a room takes about a minute, and the whole
            show is yours to keep.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={ctaHref}
              className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-7 py-4 text-[15px] font-semibold text-white"
            >
              {ctaLabel} <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/host/guide"
              className="inline-flex items-center gap-2 rounded-[13px] border border-line bg-surface/40 px-[26px] py-4 text-[15px] font-semibold text-primary transition-colors hover:bg-raised"
            >
              Read the host handbook
            </Link>
          </div>
          {note ? <p className="mt-4 text-sm text-secondary">{note}</p> : null}
        </div>
        <HeroProductShot />
      </section>

      {/* OWNERSHIP STAT BAND */}
      <section className="border-y border-line px-5 py-9 sm:px-10">
        <div className="mx-auto grid max-w-[1010px] grid-cols-2 md:grid-cols-4">
          {OWNERSHIP.map((s, i) => (
            <div
              key={s.l}
              className={`px-5 py-2 text-center ${i > 0 ? "md:border-l md:border-line" : ""}`}
            >
              <div
                className={`display text-[42px] ${s.red ? "text-red" : "text-primary"}`}
              >
                {s.n}
              </div>
              <div className="mt-1 text-[13px] text-secondary">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PROMISES */}
      <section className="mx-auto max-w-[1010px] px-5 pt-14 pb-2 sm:px-10">
        <div className="grid gap-3 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <div key={p.k} className="rounded-2xl border border-line bg-raised px-6 pt-[26px] pb-7">
              <h3 className="t-title font-extrabold">{p.k}</h3>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-secondary">
                {p.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* STEPS */}
      <section className="mx-auto max-w-[1010px] px-5 pt-12 pb-5 sm:px-10">
        <h2 className="display max-w-[680px] t-h2">From account to on air</h2>
        <div className="mt-9 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {HOST_STEPS.map((s) => (
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
              <p className="mt-2.5 text-sm leading-[1.55] text-secondary">
                {s.d}
              </p>
            </div>
          ))}
        </div>

        {/* THE ONE RULE — audio only (load-bearing compliance) */}
        <div className="mt-8 rounded-2xl border border-red/30 bg-inset px-6 py-7">
          <div className={`${eyebrow} mb-3`}>THE ONE RULE</div>
          <h3 className="display t-h3">Audio only, always</h3>
          <p className="mt-2 mb-5 max-w-[680px] text-sm leading-[1.6] text-secondary">
            Your show is your voice and your guests. Never play match video or
            broadcast audio through it, even in the background. That rule is what
            keeps the whole platform on the right side of the line, and it is the
            one thing we cannot bend.
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
        <div className={`${eyebrow} mb-3.5`}>QUESTIONS FROM HOSTS</div>
        <h2 className="display t-h2">Before you go on</h2>
        <Faq items={HOST_FAQ} />
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
          <h2 className="display mx-auto t-h2">There&apos;s a seat at the front. Take it.</h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[16px] text-secondary">
            Become a commentator in about a minute. No platform fee, tips are
            yours, every recording is yours to keep.
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href={ctaHref}
              className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-7 py-4 text-[15px] font-semibold text-white"
            >
              {ctaLabel} <span aria-hidden="true">→</span>
              <span aria-hidden="true" className="btn-shine" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
