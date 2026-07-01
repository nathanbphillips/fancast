"use client";

import { useState } from "react";
import { KickoffTime } from "@/components/KickoffTime";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { OpenWaitingButton } from "@/components/OpenWaitingButton";
import type { HomeFixture } from "@/lib/db/fixtures";

type Filter = "all" | "live" | "upcoming";

/** Matches schedule with client-side filter pills (Cloud Design). Live + upcoming
 *  come from the server; PAST is deferred until past fixtures are loaded. */
export function MatchesBrowser({
  live,
  upcoming,
}: {
  live: HomeFixture[];
  upcoming: HomeFixture[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const showLive = filter === "all" || filter === "live";
  const showUpcoming = filter === "all" || filter === "upcoming";

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "live", label: "Live" },
    { id: "upcoming", label: "Upcoming" },
  ];

  return (
    <>
      <div className="mt-6 flex gap-2" role="tablist" aria-label="Filter matches">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 font-mono text-[11px] font-bold tracking-wider uppercase transition-colors ${
              filter === f.id
                ? "bg-inverted text-inverted-fg"
                : "border border-line text-secondary hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showLive && live.length > 0 && (
        <section className="mt-8" aria-label="Live now">
          <p className="mb-3 font-mono text-[11px] font-bold tracking-wider text-secondary uppercase">
            Live now
          </p>
          <div className="space-y-4">
            {live.map((w) => (
              <div
                key={w.card.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-red/30 bg-inset p-6"
              >
                <div className="flex items-center gap-3">
                  <Pill variant="red" live>
                    Live now
                  </Pill>
                  <span className="font-mono text-[10px] tracking-wider text-secondary uppercase">
                    {w.card.competition}
                  </span>
                </div>
                <div className="min-w-[220px] flex-1">
                  <h3 className="font-display text-2xl">
                    {w.card.home} vs {w.card.away}
                  </h3>
                  <p className="font-mono text-[11px] text-secondary">
                    {w.card.state === "waiting" ? "Show starts soon" : "Live"}
                    {w.card.commentator ? ` · hosted by ${w.card.commentator}` : ""}
                  </p>
                </div>
                {w.card.roomHref && (
                  <Button href={w.card.roomHref} variant="inverted">
                    {w.card.state === "live" ? "Join live" : "Join the waiting room"}{" "}
                    →
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showLive && filter === "live" && live.length === 0 && (
        <p className="mt-8 rounded-2xl border border-line bg-surface p-6 text-sm text-secondary">
          No live rooms right now — check the upcoming schedule.
        </p>
      )}

      {showUpcoming && (
        <section className="mt-8" aria-label="Upcoming">
          <p className="mb-3 font-mono text-[11px] font-bold tracking-wider text-secondary uppercase">
            Upcoming
          </p>
          {upcoming.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-secondary">
              Nothing scheduled yet — check back soon.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {upcoming.map((w) => (
                <div
                  key={w.card.id}
                  className="flex items-center gap-5 border-t border-line px-5 py-5 first:border-t-0"
                >
                  <span className="w-24 shrink-0 font-mono text-[11px] tracking-wide text-secondary uppercase">
                    <KickoffTime iso={w.card.kickoffUtc} />
                  </span>
                  <span className="hidden h-9 w-px bg-line sm:block" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold">
                      {w.card.home} vs {w.card.away}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-secondary uppercase">
                      {w.card.competition}
                    </span>
                  </span>
                  {w.canOpen ? (
                    <OpenWaitingButton fixtureId={w.card.id} />
                  ) : w.card.roomHref ? (
                    <Button href={w.card.roomHref} variant="outline" size="sm">
                      Join
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
