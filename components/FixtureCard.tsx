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

export function FixtureCard({ fixture }: { fixture: FixtureCardData }) {
  const { state } = fixture;
  const accent =
    state === "live"
      ? "border-l-4 border-l-red"
      : state === "waiting"
        ? "border-l-4 border-l-gold"
        : "";

  return (
    <article
      className={`rounded-xl border-[0.75px] border-line bg-surface p-4 ${accent}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-secondary">{fixture.competition}</p>
          <h3 className={`mt-0.5 font-bold ${state === "live" ? "text-xl" : "text-base"}`}>
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
                <KickoffTime iso={fixture.kickoffUtc} />
                {fixture.commentator && <> · {fixture.commentator}</>}
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {state === "live" && (
            <span className="flex items-center gap-1.5 rounded-md bg-red px-2 py-1 text-xs font-bold text-white">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" />
              LIVE
            </span>
          )}
          {state !== "scheduled" && fixture.roomHref && (
            <Link
              href={fixture.roomHref}
              className={`flex h-11 items-center rounded-lg px-4 text-sm font-semibold ${
                state === "live"
                  ? "bg-red text-white"
                  : "border border-line bg-surface hover:bg-raised"
              }`}
            >
              {state === "live" ? "Join live" : "Join waiting room"}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
