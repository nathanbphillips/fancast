import { KickoffTime } from "@/components/KickoffTime";
import { RoomRow } from "@/components/matches/RoomRow";
import type { ScheduleGroup } from "@/lib/db/matches";

/**
 * The date-grouped matches schedule (FR-22.4): date headers, a fixture header
 * row, then its rooms beneath. Fixtures with no rooms render as schedule
 * information with no join affordance. Server-rendered; RoomRow is the client
 * leaf that holds the RSVP toggle.
 */
export function MatchesSchedule({
  groups,
  signedIn,
}: {
  groups: ScheduleGroup[];
  signedIn: boolean;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-secondary">
        No fixtures on the board right now. Check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="mb-3 font-mono text-[12px] font-bold tracking-[0.14em] text-gold uppercase">
            {group.label}
          </h2>
          <div className="space-y-3">
            {group.fixtures.map((fixture) => (
              <div
                key={fixture.id}
                className="overflow-hidden rounded-2xl border border-line bg-surface"
              >
                {/* fixture header row */}
                <div className="flex items-center gap-4 border-b border-line/60 px-4 py-3">
                  <span className="w-16 shrink-0 font-mono text-[11px] leading-snug text-secondary tabular-nums">
                    <KickoffTime iso={fixture.kickoffUtc} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-extrabold tracking-[-0.01em]">
                      {fixture.home} vs {fixture.away}
                    </span>
                    {fixture.competition && (
                      <span className="block truncate font-mono text-[10px] text-secondary uppercase">
                        {fixture.competition}
                      </span>
                    )}
                  </span>
                </div>

                {/* rooms, or a no-room note */}
                {fixture.rooms.length > 0 ? (
                  <div className="divide-y divide-line/40 px-4">
                    {fixture.rooms.map((room) => (
                      <RoomRow
                        key={room.id}
                        room={room}
                        signedIn={signedIn}
                        matchLabel={`${fixture.home} vs ${fixture.away}`}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-3 text-[12.5px] text-secondary">
                    No room yet for this fixture.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
