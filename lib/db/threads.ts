import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage } from "./types";

/**
 * Load a room's chat as COMPLETE threads (Phase 11 Slice 3). Fetching the most
 * recent N messages would split a thread across the cap (a reply in-window whose
 * root is out, or vice versa). Instead take the N most recent top-level roots,
 * then every row whose root_id is one of them — so each thread arrives whole and
 * the client can rebuild the tree. Pass the RLS client so hidden rows stay
 * filtered (migrations 0011 chat / 0017 link); replies under a hidden root drop
 * out naturally because the hidden root never enters the root set.
 */
export async function loadRoomThreadMessages(
  client: SupabaseClient,
  roomId: string,
  rootLimit = 200,
): Promise<ChatMessage[]> {
  const { data: roots } = await client
    .from("chat_messages")
    .select("id")
    .eq("room_id", roomId)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(rootLimit);
  const rootIds = (roots ?? []).map((r: { id: string }) => r.id);
  if (rootIds.length === 0) return [];
  const { data } = await client
    .from("chat_messages")
    .select("*, author:profiles!chat_messages_user_id_fkey(username, role, avatar_url)")
    .eq("room_id", roomId) // keep the (room_id, root_id, created_at) index usable
    .in("root_id", rootIds)
    .order("created_at", { ascending: true })
    .returns<ChatMessage[]>();
  return data ?? [];
}
