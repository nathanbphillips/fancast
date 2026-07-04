import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type { RoomState } from "@/lib/db/types";
import { KickoffTime } from "@/components/KickoffTime";
import { CancelRoomButton } from "@/components/host/CancelRoomButton";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "My rooms" };

/**
 * My rooms dashboard (FR-19, thin v1): upcoming hosted rooms chronologically
 * with per-row cancel, and the Create room entry. Grows into the bulk /
 * subscription surface in PRD-03.
 */

const UPCOMING_STATES: RoomState[] = [
  "scheduled",
  "waiting",
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

type HostedRoom = {
  room_id: string;
  room: {
    id: string;
    slug: string | null;
    state: RoomState;
    scheduled_kickoff: string;
    blurb: string | null;
    postponed: boolean;
    fixture: { home_team: string; away_team: string; competition: string | null };
  };
};

export default async function HostDashboardPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/signin");
  if (!profile) redirect("/welcome");
  // listeners get pointed at the upgrade flow instead of a dead page
  if (profile.role === "listener") redirect("/settings");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("room_hosts")
    .select(
      "room_id, room:rooms(id, slug, state, scheduled_kickoff, blurb, postponed, fixture:fixtures(home_team, away_team, competition))",
    )
    .eq("user_id", user.id)
    .eq("status", "accepted");
  const hosted = ((data ?? []) as unknown as HostedRoom[])
    .filter((h) => h.room && UPCOMING_STATES.includes(h.room.state))
    .sort((a, b) =>
      a.room.scheduled_kickoff.localeCompare(b.room.scheduled_kickoff),
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
            Hosting
          </p>
          <h1 className="display text-4xl">My rooms</h1>
        </div>
        <Button href="/host/new" variant="red">
          Create room →
        </Button>
      </div>

      <div className="mt-8">
        {hosted.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-secondary">
            No upcoming rooms yet. Pick a fixture and your room is scheduled in
            two taps.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {hosted.map(({ room: r }) => {
              const label = `${r.fixture.home_team} vs ${r.fixture.away_team}`;
              const enterable = r.state !== "scheduled";
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-4 border-t border-line px-4 py-3.5 first:border-t-0"
                >
                  <span className="w-24 shrink-0 font-mono text-[10px] leading-snug tracking-wide text-secondary uppercase">
                    <KickoffTime iso={r.scheduled_kickoff} />
                  </span>
                  <span className="min-w-0 flex-1">
                    {enterable ? (
                      <Link
                        href={`/room/${r.slug ?? r.id}`}
                        className="block truncate text-sm font-bold tracking-[-0.01em] hover:underline"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-bold tracking-[-0.01em]">
                        {label}
                      </span>
                    )}
                    <span className="block truncate font-mono text-[10px] text-secondary uppercase">
                      {r.postponed
                        ? "Postponed"
                        : (r.fixture.competition ?? "")}
                      {r.blurb ? ` · ${r.blurb}` : ""}
                    </span>
                  </span>
                  {enterable ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-red px-2 py-1 font-mono text-[10px] tracking-wide text-white uppercase">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-white"
                      />
                      Live
                    </span>
                  ) : (
                    <CancelRoomButton roomId={r.id} matchLabel={label} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
