import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * THE host permission check (FR-19.4, cross-cutting epic rule 3): every
 * "is this the commentator/host?" decision routes through here, backed by
 * room_hosts. Equal hosts, no primary. `rooms.commentator_id` remains only as
 * creator-of-record; do not compare against it in new code. PRD-08 audits and
 * converts the pre-epic call sites.
 */
export async function isRoomHost(
  service: SupabaseClient,
  userId: string,
  roomId: string,
): Promise<boolean> {
  const { data } = await service
    .from("room_hosts")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();
  return data !== null;
}

/** Accepted hosts of a room (usernames + ids), creator first. */
export async function acceptedHosts(
  service: SupabaseClient,
  roomId: string,
): Promise<{ user_id: string; username: string }[]> {
  const { data } = await service
    .from("room_hosts")
    .select("user_id, created_at, host:profiles!room_hosts_user_id_fkey(username)")
    .eq("room_id", roomId)
    .eq("status", "accepted")
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    user_id: r.user_id as string,
    username:
      (r.host as unknown as { username: string } | null)?.username ?? "unknown",
  }));
}
