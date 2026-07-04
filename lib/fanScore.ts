import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fan score (FR-24). The number and its components live in profile_stats and
 * are kept current by incremental recomputes (after message/vote events) plus
 * a nightly full recompute. NEVER computed on page load. The heavy lifting is
 * two SQL functions (migration 0033); this is the thin server-side wrapper.
 */

/** Recompute one user's stats after a message/vote event. Fire-and-forget in
 *  after(); a failure just means the nightly pass will heal it. */
export async function recomputeUser(
  service: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await service.rpc("recompute_profile_stats", {
    uid: userId,
  });
  if (error) console.error("recomputeUser failed for", userId, error.message);
}

/** Nightly full recompute (self-heal drift + weighting changes). */
export async function recomputeAll(
  service: SupabaseClient,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await service.rpc("recompute_all_profile_stats");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type AttendedMatch = {
  roomSlug: string | null;
  roomId: string;
  home: string;
  away: string;
  kickoffUtc: string;
  hostUsername: string;
};

type SegmentRow = {
  room_id: string;
  started_at: string;
  ended_at: string | null;
};

/**
 * The user's most-recent attended matches (FR-24.3): rooms with 15+ cumulative
 * minutes in listener_segments. Public in v1. Aggregated server-side; this is a
 * profile-page read, not a hot path.
 */
export async function loadAttendedMatches(
  service: SupabaseClient,
  userId: string,
  limit = 10,
): Promise<AttendedMatch[]> {
  const { data: segments } = await service
    .from("listener_segments")
    .select("room_id, started_at, ended_at")
    .eq("user_id", userId)
    .returns<SegmentRow[]>();
  if (!segments || segments.length === 0) return [];

  const now = Date.now();
  const byRoom = new Map<string, { secs: number; latest: number }>();
  for (const s of segments) {
    const start = new Date(s.started_at).getTime();
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
    const prev = byRoom.get(s.room_id) ?? { secs: 0, latest: 0 };
    byRoom.set(s.room_id, {
      secs: prev.secs + Math.max(0, (end - start) / 1000),
      latest: Math.max(prev.latest, start),
    });
  }
  const attendedRoomIds = [...byRoom.entries()]
    .filter(([, v]) => v.secs >= 900)
    .sort((a, b) => b[1].latest - a[1].latest)
    .slice(0, limit)
    .map(([roomId]) => roomId);
  if (attendedRoomIds.length === 0) return [];

  const { data: rooms } = await service
    .from("rooms")
    .select(
      "id, slug, commentator:profiles!rooms_commentator_id_fkey(username), fixture:fixtures(home_team, away_team, kickoff_utc)",
    )
    .in("id", attendedRoomIds);

  // preserve the recency order from attendedRoomIds
  const roomMap = new Map((rooms ?? []).map((r) => [r.id as string, r]));
  return attendedRoomIds
    .map((id) => roomMap.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => {
      const fx = r.fixture as unknown as {
        home_team: string;
        away_team: string;
        kickoff_utc: string;
      } | null;
      const host = r.commentator as unknown as { username: string } | null;
      return {
        roomId: r.id as string,
        roomSlug: r.slug as string | null,
        home: fx?.home_team ?? "TBD",
        away: fx?.away_team ?? "TBD",
        kickoffUtc: fx?.kickoff_utc ?? "",
        hostUsername: host?.username ?? "unknown",
      };
    });
}
