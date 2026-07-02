import type { SupabaseClient } from "@supabase/supabase-js";

/** Flag summary attached to talk requests so commentators can make
 *  informed Accept/Dismiss calls. Commentator/admin eyes only. */

export type CallerFlagSummary = {
  count: number;
  notes: { note: string | null; by: string; at: string }[];
};

/** A waiting caller's 1-based position in the room's pending call-in queue,
 *  ordered by request time. Privacy-preserving: returns only the number, never
 *  the roster. null if the user has no pending request. (Phase 5c) */
export async function queuePositionFor(
  service: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<number | null> {
  const { data: mine } = await service
    .from("talk_requests")
    .select("created_at")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle<{ created_at: string }>();
  if (!mine) return null;
  const { count } = await service
    .from("talk_requests")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("status", "pending")
    .lte("created_at", mine.created_at);
  return count ?? 1;
}

/** Pending requesters' user_ids in a room, ordered by request time (position =
 *  index + 1). Used to push each waiting caller their fresh #N on their OWN
 *  per-user channel after the queue changes — the list itself is never
 *  broadcast (FR-4.2 privacy). (Phase 5c) */
export async function pendingQueue(
  service: SupabaseClient,
  roomId: string,
): Promise<string[]> {
  const { data } = await service
    .from("talk_requests")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => r.user_id as string);
}

export async function callerFlagSummary(
  service: SupabaseClient,
  userId: string,
): Promise<CallerFlagSummary> {
  const [{ count }, { data: recent }] = await Promise.all([
    service
      .from("caller_flags")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    service
      .from("caller_flags")
      .select(
        "note, created_at, flagger:profiles!caller_flags_flagged_by_fkey(username)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  return {
    count: count ?? 0,
    notes: (recent ?? []).map((f) => ({
      note: f.note,
      by:
        (f.flagger as unknown as { username: string } | null)?.username ??
        "unknown",
      at: f.created_at,
    })),
  };
}
