import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import {
  RoomCreatePicker,
  type PickerFixture,
} from "@/components/host/RoomCreatePicker";

export const metadata: Metadata = { title: "Create room" };

/**
 * Fixture picker (FR-19.1): chronological upcoming games from the fixtures
 * cache; past games and fixtures the caller already hosts are excluded. The
 * picker is the only path to a room (FR-19.8).
 */
export default async function CreateRoomPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/signin");
  if (!profile) redirect("/welcome");
  if (profile.role === "listener") redirect("/settings");

  const supabase = await createSupabaseServerClient();
  const [{ data: fixtures }, { data: mine }] = await Promise.all([
    supabase
      .from("fixtures")
      .select("id, home_team, away_team, competition, kickoff_utc")
      .gt("kickoff_utc", new Date().toISOString())
      .order("kickoff_utc", { ascending: true })
      .limit(200),
    supabase
      .from("rooms")
      .select("fixture_id, state")
      .eq("commentator_id", user.id),
  ]);

  const hostedFixtureIds = new Set(
    (mine ?? [])
      .filter((r) => r.state !== "canceled")
      .map((r) => r.fixture_id as number),
  );
  const pickable: PickerFixture[] = ((fixtures ?? []) as PickerFixture[]).filter(
    (f) => !hostedFixtureIds.has(f.id),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
        Hosting
      </p>
      <h1 className="display text-4xl">Create a room</h1>
      <p className="mt-3 max-w-lg text-sm text-secondary">
        Pick a fixture. The match details come from the schedule; you only set
        when your show starts and, if you like, a one-line blurb.
      </p>

      <div className="mt-8">
        <RoomCreatePicker fixtures={pickable} />
      </div>

      <p className="mt-6">
        <Link
          href="/host"
          className="text-sm text-secondary transition-colors hover:text-primary"
        >
          ← Back to my rooms
        </Link>
      </p>
    </div>
  );
}
