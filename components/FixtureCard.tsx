import Link from "next/link";
import { KickoffTime } from "./KickoffTime";

/**
 * Fixture card in its three visual states (docs/DESIGN.md, PRD FR-1):
 * - scheduled: informational only, no join affordance (no room, or room
 *   still in `scheduled` state — enterability gating per FR-1.2)
 * - waiting: joinable, "Show starts soon", gold accent
 * - live: dominant card, red accent, LIVE pulse
 */

export type FixtureCardState = "scheduled" | "waiting" | "live";

export type FixtureCardData = {
  id: number;
  home: string;
  away: string;
  competition: string;
  kickoffUtc: string;
  commentator?: string;
  state: FixtureCardState;
  roomHref?: string;
  listeners?: number;
};

export function FixtureCard({
  fixture,
  action,
}: {
  fixture: FixtureCardData;
  /** optional extra affordance (e.g. commentator's Open Waiting Room) */
  action?: React.ReactNode;
}) {
  const { state } = fixture;
  const accent =
    state === "live"
      ? "border-l-4 border-l-red shadow-raised"
      : state === "waiting"
        ? "border-l-4 border-l-gold shadow-card"
        : "shadow-card";

  return (
    <article
      className={`rounded-xl border-[0.75px] border-line bg-surface p-4 ${accent}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-semibold tracking-wider text-secondary uppercase">
            {fixture.competition}
            {state !== "scheduled" && (
              <span className="text-gold"> · Live now</span>
            )}
          </p>
          <h3
            className={`mt-1 font-display font-bold ${state === "live" ? "text-xl" : "text-base"}`}
          >
            {fixture.home} vs {fixture.away}
          </h3>
          <p className="mt-1 text-sm text-secondary">
            {state === "live" ? (
              <span className="text-primary">
                With <span className="font-semibold text-gold">{fixture.commentator}</span>
                {fixture.listeners !== undefined && (
                  <span className="text-secondary tabular-nums">
                    {" "}· {fixture.listeners} listening
                  </span>
                )}
              </span>
            ) : state === "waiting" ? (
              <>
                Show starts soon
                {fixture.commentator && (
                  <> · <span className="font-semibold text-gold">{fixture.commentator}</span></>
                )}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 align-middle">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4.5" width="18" height="17" rx="2" />
                    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
                  </svg>
                  <KickoffTime iso={fixture.kickoffUtc} />
                </span>
                {fixture.commentator && <> · {fixture.commentator}</>}
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex flex-col items-end gap-2">
            {state === "live" && (
              <span className="flex items-center gap-1.5 rounded-md bg-red px-2 py-1 text-xs font-bold text-white">
                <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" />
                LIVE
              </span>
            )}
            {state !== "scheduled" && fixture.roomHref && (
              <Link
                href={fixture.roomHref}
                className="flex h-11 items-center rounded-lg bg-red px-4 text-sm font-semibold text-white"
              >
                {state === "live" ? "Join live" : "Join waiting room"}
              </Link>
            )}
            {action}
          </div>
          {(fixture.roomHref || action) && (
            <span aria-hidden="true" className="text-xl text-secondary">
              ›
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
