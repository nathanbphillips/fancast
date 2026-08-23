import type { SupabaseClient } from "@supabase/supabase-js";

/** Latest pause/resume marker decides whether the recording is paused.
 *  Shared by the pause route, the reconnect snapshot, the room page's initial
 *  props and End Broadcast (which closes an open pause). */
export async function recordingPauseState(
  service: SupabaseClient,
  roomId: string,
): Promise<{ paused: boolean; since: string | null }> {
  const { data } = await service
    .from("broadcast_markers")
    .select("kind, server_ts")
    .eq("room_id", roomId)
    .in("kind", ["record_pause", "record_resume"])
    .order("server_ts", { ascending: false })
    .limit(1)
    .maybeSingle<{ kind: string; server_ts: string }>();
  if (!data || data.kind !== "record_pause") return { paused: false, since: null };
  return { paused: true, since: data.server_ts };
}
