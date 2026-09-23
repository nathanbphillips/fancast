import Link from "next/link";
import { DEMO_ROOM_HREF } from "@/lib/config";
import { PageMasthead, PageTitle } from "@/components/marketing/PageMasthead";

/**
 * Page 3: RUN THE SHOW (Programme redesign - the mock's page, layout and
 * copy, founder 2026-09-13; the old /creators pitch is blended in here and
 * /creators redirects). Rendered at /host for visitors and listeners; hosts
 * see their dashboard instead. Subpage masthead -> title -> ON AIR IN THREE
 * STEPS -> THE DEAL, IN FULL -> YOUR DESK INCLUDES -> CTA row. No em dashes;
 * never implies showing the match.
 */

const STEPS = [
  {
    n: "1.",
    t: "Pick a match",
    d: "Or no match at all - transfers, news reaction, a regular show. Rooms open around the clock.",
  },
  {
    n: "2.",
    t: "Schedule it",
    d: "Your room goes on the fixtures page. Followers get a nudge, listeners RSVP.",
  },
  {
    n: "3.",
    t: "Go live",
    d: "Talk. Take callers, run polls, push team news. Listeners sync your voice to their own screen.",
  },
];

const DESK = [
  "Caller queue and mic control",
  "Live polls and player ratings",
  "Lineups and team-news push",
  "Chat moderation tools",
  "Scheduling with RSVP list",
  "Downloadable show files after full time",
];

export function HostLanding({
  ctaHref,
  ctaLabel,
  note,
}: {
  /** role-aware onboarding destination (sign-in for visitors, settings for listeners) */
  ctaHref: string;
  ctaLabel: string;
  note?: string;
}) {
  return (
    <div className="mx-auto max-w-[1000px] px-5 pt-6 pb-14 sm:px-10">
      <PageMasthead page={3} />
      <PageTitle
        kicker="Situations vacant - no experience required"
        title="Run the show"
        standfirst={
          <>
            Become the commentator. Your club, your take, your show - setup
            takes about a minute, and all you need is a mic and an opinion.
          </>
        }
      />

      {/* ON AIR IN THREE STEPS */}
      <div className="mt-9">
        <h2 className="display border-b-[3px] border-double border-primary pb-2.5 text-center text-[28px]">
          On air in three steps
        </h2>
        <div className="mt-1.5 grid sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.t}
              className={`py-5 sm:px-6 ${i < 2 ? "sm:border-r sm:border-line" : "sm:pr-0"} ${
                i === 0 ? "sm:pl-0" : ""
              }`}
            >
              <div className="display text-[22px]">
                <span className="text-red">{s.n}</span> {s.t}
              </div>
              <p className="mt-2 text-[16.5px] leading-[1.6] text-secondary">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* THE DEAL, IN FULL */}
      <div className="mt-9 border-2 border-primary p-6 sm:p-8">
        <p className="font-mono text-[14px] tracking-[0.16em] text-red">
          The deal, in full
        </p>
        <div className="mt-3.5 grid gap-x-5 gap-y-3.5 text-[16.5px] leading-[1.6] sm:grid-cols-[170px_1fr]">
          <span className="font-mono text-[15px] font-semibold tracking-[0.1em]">
            Platform fee
          </span>
          <span>
            None. Zero. <strong className="font-semibold text-red">£0.</strong>
          </span>
          <span className="font-mono text-[15px] font-semibold tracking-[0.1em]">
            Recordings
          </span>
          <span>
            100% yours. Every show is cut into downloadable files - pre-game,
            full match, post-game - ready for any podcast feed the moment you
            wrap.
          </span>
          <span className="font-mono text-[15px] font-semibold tracking-[0.1em]">
            The one rule
          </span>
          <span>
            Audio only, always. Never the match itself, never broadcast feed.
          </span>
        </div>
        <p className="mt-4 border-t border-line pt-3.5 text-[14.5px] text-secondary italic">
          Podcasters: run your live call-in show here, then take the recording
          home. It stays yours, no strings.
        </p>
      </div>

      {/* YOUR DESK INCLUDES */}
      <div className="mt-9">
        <h2 className="display border-b-[3px] border-double border-primary pb-2.5 text-center text-[28px]">
          Your desk includes
        </h2>
        <div className="mt-4.5 grid gap-x-8 gap-y-3 text-[16.5px] leading-[1.6] sm:grid-cols-2">
          {DESK.map((d) => (
            <span key={d}>· {d}</span>
          ))}
        </div>
      </div>

      {/* CTA ROW (primary is role-aware: sign-in for visitors, upgrade for listeners) */}
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href={ctaHref}
          className="btn-grad-red px-6 py-3.5 text-[16px] whitespace-nowrap"
        >
          {ctaLabel} →
        </Link>
        <Link
          href="/how-it-works"
          className="border-2 border-primary px-6 py-3 font-mono text-[15px] tracking-[0.12em] whitespace-nowrap text-primary hover:text-red"
        >
          First, how it works →
        </Link>
        <Link
          href={DEMO_ROOM_HREF}
          className="border-2 border-red px-6 py-3 font-mono text-[15px] tracking-[0.12em] whitespace-nowrap text-red hover:opacity-80"
        >
          Sit in the demo room →
        </Link>
      </div>
      {note && (
        <p className="mt-4 text-center text-[14.5px] text-secondary italic">
          {note}
        </p>
      )}
    </div>
  );
}
