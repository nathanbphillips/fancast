import Link from "next/link";
import { brand } from "@/lib/brand";

/**
 * Marketing host-landing (front-end review items 12/14): the supply-side pitch,
 * shown at /host to anyone who isn't yet a commentator (signed-out or listener).
 * Commentators get the dashboard instead. This is the single home for the host
 * story, moved out of the bottom of /how-it-works so every host CTA has one real
 * destination. Compliance: the "audio only" rule is the load-bearing one.
 */

const HOST_STEPS = [
  {
    n: "01",
    t: "Become a commentator",
    d: "Any account can upgrade from settings: read the terms, tick the box, and you can host today. No application, no waiting.",
  },
  {
    n: "02",
    t: "Create a room",
    d: "Pick an upcoming fixture from the schedule. Two inputs, that is it: when your show starts (it defaults to fifteen minutes before kickoff) and an optional one-line blurb. Everything else comes from the fixture, and your room gets a clean, shareable link.",
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
  { k: "You own 100%", d: "Every recording is yours. We take no license and no cut of it." },
  { k: "No platform fee to host", d: "Hosting a room is free. Tips go to you, minus only payment costs." },
  { k: "Equal co-hosts", d: "Share a room with another supporter. No primary, both keep the recordings." },
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
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(110% 90% at 85% -20%, rgba(241,35,43,0.16), transparent 56%), var(--bg-base)",
        }}
      >
        <div className="relative mx-auto max-w-[1180px] px-5 pt-16 pb-10 sm:px-10">
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold-bright" />
            For commentators
          </p>
          <h1 className="display max-w-[720px] t-hero tracking-[0.005em]">
            Host your own room
          </h1>
          <p className="mt-5 max-w-[580px] text-[18px] leading-[1.55] text-secondary">
            If you know the club and you can hold a mic, there is a seat for you
            at the front. Setting up a room takes about a minute, and the whole
            show is yours to keep.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 rounded-[11px] bg-red px-6 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-red-hover"
            >
              {ctaLabel} <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/host/guide"
              className="inline-flex items-center rounded-[11px] border border-line px-[22px] py-[15px] text-[15px] font-bold transition-colors hover:bg-surface"
            >
              Read the host handbook
            </Link>
          </div>
          {note ? (
            <p className="mt-4 text-sm text-secondary">{note}</p>
          ) : null}
        </div>
      </section>

      {/* PROMISES */}
      <section className="mx-auto max-w-[1180px] px-5 pt-12 pb-2 sm:px-10">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {PROMISES.map((p) => (
            <div key={p.k} className="bg-surface px-6 pt-[26px] pb-7">
              <h3 className="t-title font-extrabold tracking-[-0.01em]">
                {p.k}
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-secondary">
                {p.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* STEPS */}
      <section className="mx-auto max-w-[1180px] px-5 pt-12 pb-5 sm:px-10">
        <h2 className="display max-w-[680px] t-h2">
          From account to on air
        </h2>
        <div className="mt-9 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {HOST_STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-line bg-surface px-6 pt-6 pb-7 shadow-card"
            >
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-gold-bright font-mono text-sm font-bold text-[#141210]">
                {s.n}
              </span>
              <h3 className="mt-5 t-title font-extrabold tracking-[-0.01em]">
                {s.t}
              </h3>
              <p className="mt-2.5 text-sm leading-[1.55] text-secondary">
                {s.d}
              </p>
            </div>
          ))}
        </div>

        {/* the one rule */}
        <div className="mt-8 rounded-2xl border border-red/30 bg-inset px-6 py-6">
          <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-red uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red" />
            The one rule
          </p>
          <h3 className="text-lg font-extrabold tracking-[-0.01em]">
            Audio only, always
          </h3>
          <p className="mt-2 max-w-[680px] text-sm leading-[1.6] text-secondary">
            Your show is your voice and your guests. Never play match video or
            broadcast audio through it, even in the background. That rule is what
            keeps the whole platform on the right side of the line, and it is the
            one thing we cannot bend.
          </p>
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-3.5">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-[11px] bg-red px-6 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-red-hover"
          >
            {ctaLabel} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
