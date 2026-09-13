"use client";

import { useState } from "react";
import Link from "next/link";
import type { ScheduleGroup, ScheduleFixture } from "@/lib/db/matches";
import { RsvpButton } from "@/components/matches/RsvpButton";
import { LocalTime } from "@/components/KickoffTime";

/**
 * The full schedule (Matchday design): client-side filter pills (All fixtures /
 * Arsenal only / With a room) over date-grouped flat fixture rows. Each row's
 * action reflects real room state — live → Join, scheduled → Count me in
 * (RSVP), none → Notify me. No fabricated counts. Filtering is purely local
 * (the founder's earlier "defer filters" note is superseded by this design).
 */

const FILTERS = [
  { id: "all", label: "All fixtures" },
  { id: "arsenal", label: "Arsenal only" },
  { id: "room", label: "With a room" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const isArsenal = (f: ScheduleFixture) =>
  f.home === "Arsenal" || f.away === "Arsenal";

export function ScheduleBoard({
  groups,
  signedIn,
}: {
  groups: ScheduleGroup[];
  signedIn: boolean;
}) {
  const [filter, setFilter] = useState<FilterId>("all");

  const filtered = groups
    .map((g) => ({
      ...g,
      fixtures: g.fixtures.filter((f) =>
        filter === "arsenal"
          ? isArsenal(f)
          : filter === "room"
            ? f.rooms.length > 0
            : true,
      ),
    }))
    .filter((g) => g.fixtures.length > 0);
  const total = filtered.reduce((n, g) => n + g.fixtures.length, 0);

  return (
    <div>
      {/* filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={
              filter === f.id
                ? "bg-inverted px-4 py-2.5 font-mono text-[12px] font-bold tracking-[0.06em] text-inverted-fg"
                : "border border-line px-4 py-2.5 font-mono text-[12px] font-semibold tracking-[0.06em] text-secondary transition-colors hover:text-primary"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* section label */}
      <div className="mb-2 flex items-center gap-3 border-b-[3px] border-double border-primary pb-2">
        <span className="font-mono text-[12px] tracking-[0.1em] text-red">
          FULL SCHEDULE
        </span>
        <span aria-hidden="true" className="flex-1" />
        <span className="font-mono text-[12px] text-tertiary tabular-nums">
          {total} {total === 1 ? "fixture" : "fixtures"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="border border-line bg-canvas p-6 text-sm text-secondary italic">
          Nothing matches that filter yet.
        </p>
      ) : (
        filtered.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <div className="sticky top-0 z-[3] flex items-center gap-3 border-b border-line bg-canvas py-2.5">
              <h2 className="font-mono text-[12px] tracking-[0.1em] text-red uppercase">
                {g.label}
              </h2>
              <span className="font-mono text-[10px] tracking-[0.04em] text-tertiary uppercase">
                {g.fixtures.length} {g.fixtures.length === 1 ? "match" : "matches"}
              </span>
            </div>
            <div className="mb-2 flex flex-col">
              {g.fixtures.map((f) => {
                const liveRoom = f.rooms.find((r) => r.state !== "scheduled");
                const schedRoom = f.rooms.find((r) => r.state === "scheduled");
                return (
                  <div
                    key={f.id}
                    className="relative flex items-center gap-3 border-b border-line py-3 pr-1 pl-5 transition-colors hover:bg-raised"
                  >
                    {isArsenal(f) && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 bottom-2 left-0 w-[3px] bg-red-fill"
                      />
                    )}
                    <span className="w-[46px] shrink-0 font-mono text-[12px] text-secondary tabular-nums">
                      <LocalTime iso={f.kickoffUtc} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="display text-[16px]">{f.home}</span>{" "}
                      <span className="font-mono text-[12px] text-red">v</span>{" "}
                      <span className="display text-[16px]">{f.away}</span>
                    </span>
                    <span className="hidden shrink-0 text-[11px] text-tertiary italic md:block">
                      {f.competition ?? "Premier League"}
                    </span>
                    <div className="flex shrink-0 items-center gap-2.5">
                      {liveRoom ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] text-red">
                            <span className="h-1.5 w-1.5 animate-fc-blink rounded-full bg-red-fill" />
                            LIVE
                          </span>
                          <Link
                            href={`/room/${liveRoom.slug}`}
                            className="btn-grad-red px-3.5 py-2 text-[12px] font-semibold"
                          >
                            Join →
                          </Link>
                        </>
                      ) : schedRoom ? (
                        <>
                          <span className="hidden text-[11px] text-secondary italic sm:inline">
                            Room scheduled
                          </span>
                          <RsvpButton
                            roomId={schedRoom.id}
                            slug={schedRoom.slug}
                            initialRsvped={schedRoom.viewerRsvped}
                            signedIn={signedIn}
                            size="sm"
                          />
                        </>
                      ) : (
                        <>
                          <span className="hidden text-[11px] text-tertiary italic sm:inline">
                            No room yet
                          </span>
                          <Link
                            href="#notify"
                            className="border border-line px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-secondary transition-colors hover:text-primary"
                          >
                            Notify me
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
