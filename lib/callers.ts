import type { SupabaseClient } from "@supabase/supabase-js";

/** Flag summary attached to talk requests so commentators can make
 *  informed Accept/Dismiss calls. Commentator/admin eyes only. */

export type CallerFlagSummary = {
  count: number;
  notes: { note: string | null; by: string; at: string }[];
};

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
