import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFixtureStats, type FixtureStats } from "@/lib/stats";

/**
 * Cache-warming (Phase 11). The daily match-check cron fetches each upcoming
 * matched room's fixture from Sportmonks once and stores the normalized snapshot
 * in `fixture_stats_cache`. The stats proxy reads it as a cold-start / outage
 * fallback. This is $0: it rides the existing daily cron and the flat Sportmonks
 * plan, makes no extra calls beyond once-per-room-per-day, and writes a single
 * small row. We deliberately do NOT warm on the in-room 10s poll (that would add
 * a write every tick) — only the daily pass writes.
 */

/** Warm one fixture. `fixturePk` is the rooms-facing id the stats proxy keys on;
 *  `sportmonksId` is the data id Sportmonks is fetched by. Best-effort. */
export async function warmFixtureStats(
  service: SupabaseClient,
  fixturePk: number,
  sportmonksId: number,
): Promise<boolean> {
  try {
    const stats = await getFixtureStats(sportmonksId);
    const { error } = await service.from("fixture_stats_cache").upsert(
      { fixture_id: fixturePk, snapshot: stats, warmed_at: new Date().toISOString() },
      { onConflict: "fixture_id" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Read a warmed snapshot for the stats proxy fallback. */
export async function readFixtureSnapshot(
  client: SupabaseClient,
  fixturePk: number,
): Promise<FixtureStats | null> {
  const { data } = await client
    .from("fixture_stats_cache")
    .select("snapshot")
    .eq("fixture_id", fixturePk)
    .maybeSingle<{ snapshot: FixtureStats }>();
  return data?.snapshot ?? null;
}

/** Warm every matched fixture that has a room and kicks off in a recent/upcoming
 *  window. Bounded so the daily cron stays well within its time budget. */
export async function warmUpcomingFixtures(
  service: SupabaseClient,
): Promise<{ warmed: number; considered: number }> {
  const from = new Date(Date.now() - 1 * 86_400_000).toISOString(); // keep yesterday's warm
  const to = new Date(Date.now() + 10 * 86_400_000).toISOString();

  const { data: fixtures } = await service
    .from("fixtures")
    .select("id, sportmonks_fixture_id, kickoff_utc")
    .not("sportmonks_fixture_id", "is", null)
    .gte("kickoff_utc", from)
    .lte("kickoff_utc", to)
    .limit(100)
    .returns<{ id: number; sportmonks_fixture_id: number; kickoff_utc: string }[]>();

  const candidates = fixtures ?? [];
  if (candidates.length === 0) return { warmed: 0, considered: 0 };

  // only warm fixtures that actually back a room (don't burn calls on the rest)
  const { data: rooms } = await service
    .from("rooms")
    .select("fixture_id")
    .in(
      "fixture_id",
      candidates.map((f) => f.id),
    )
    .returns<{ fixture_id: number }[]>();
  const withRoom = new Set((rooms ?? []).map((r) => r.fixture_id));

  const targets = candidates.filter((f) => withRoom.has(f.id)).slice(0, 25);
  let warmed = 0;
  for (const f of targets) {
    if (await warmFixtureStats(service, f.id, f.sportmonks_fixture_id)) warmed++;
  }
  return { warmed, considered: targets.length };
}
