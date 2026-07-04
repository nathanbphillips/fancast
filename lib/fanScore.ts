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
