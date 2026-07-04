import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Friends + blocking (FR-23). All state is computed server-side (service role)
 * and SANITIZED: a decline reads as "requested" to the requester so the decline
 * stays silent (FR-23.1). Block checks are enforced here and in every friend
 * route.
 */

export type FriendState =
  | "self"
  | "none"
  | "requested" // viewer sent a pending request (or was silently declined)
  | "incoming" // the other user sent the viewer a pending request
  | "friends";

type Row = { requester_id: string; addressee_id: string; status: string };

async function pairRows(
  service: SupabaseClient,
  a: string,
  b: string,
): Promise<Row[]> {
  const { data } = await service
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`,
    );
  return (data ?? []) as Row[];
}

/** The viewer's sanitized friend state toward another user. */
export async function friendState(
  service: SupabaseClient,
  viewerId: string,
  otherId: string,
): Promise<FriendState> {
  if (viewerId === otherId) return "self";
  const rows = await pairRows(service, viewerId, otherId);
  if (rows.some((r) => r.status === "accepted")) return "friends";
  // an incoming pending request (the other user asked the viewer)
  if (
    rows.some(
      (r) =>
        r.status === "pending" &&
        r.requester_id === otherId &&
        r.addressee_id === viewerId,
    )
  ) {
    return "incoming";
  }
  // the viewer's own outbound request: pending OR silently declined both read
  // as "requested" (FR-23.1 silent decline)
  if (
    rows.some(
      (r) =>
        (r.status === "pending" || r.status === "declined") &&
        r.requester_id === viewerId &&
        r.addressee_id === otherId,
    )
  ) {
    return "requested";
  }
  return "none";
}

/** True when either user has blocked the other. */
export async function areBlockedEitherWay(
  service: SupabaseClient,
  a: string,
  b: string,
): Promise<boolean> {
  const { data } = await service
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`,
    )
    .limit(1);
  return (data ?? []).length > 0;
}

/** True when `blocker` has blocked `blocked`. */
export async function hasBlocked(
  service: SupabaseClient,
  blocker: string,
  blocked: string,
): Promise<boolean> {
  const { data } = await service
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocker_id", blocker)
    .eq("blocked_id", blocked)
    .maybeSingle();
  return data !== null;
}

export type PersonRow = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

type ProfileEmbed = {
  user_id: string;
  username: string;
  avatar_url: string | null;
} | null;

/** Owner-only lists for the settings Friends section (FR-23.5). */
export async function loadFriendsForSettings(
  service: SupabaseClient,
  userId: string,
): Promise<{ incoming: PersonRow[]; friends: PersonRow[]; blocked: PersonRow[] }> {
  const toRow = (p: ProfileEmbed): PersonRow | null =>
    p ? { userId: p.user_id, username: p.username, avatarUrl: p.avatar_url } : null;

  const [incomingRes, friendRes, blockRes] = await Promise.all([
    service
      .from("friendships")
      .select(
        "requester:profiles!friendships_requester_id_fkey(user_id, username, avatar_url)",
      )
      .eq("addressee_id", userId)
      .eq("status", "pending"),
    service
      .from("friendships")
      .select(
        "requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(user_id, username, avatar_url), addressee:profiles!friendships_addressee_id_fkey(user_id, username, avatar_url)",
      )
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    service
      .from("user_blocks")
      .select(
        "blocked:profiles!user_blocks_blocked_id_fkey(user_id, username, avatar_url)",
      )
      .eq("blocker_id", userId),
  ]);

  const incoming = (incomingRes.data ?? [])
    .map((r) => toRow(r.requester as unknown as ProfileEmbed))
    .filter((r): r is PersonRow => r !== null);
  const friends = (friendRes.data ?? [])
    .map((r) =>
      toRow(
        (r.requester_id === userId
          ? r.addressee
          : r.requester) as unknown as ProfileEmbed,
      ),
    )
    .filter((r): r is PersonRow => r !== null);
  const blocked = (blockRes.data ?? [])
    .map((r) => toRow(r.blocked as unknown as ProfileEmbed))
    .filter((r): r is PersonRow => r !== null);

  return { incoming, friends, blocked };
}

/**
 * Accepted friends' user ids for a user, EXCLUDING anyone in a block relation
 * with them (a block removes both from each other's chips, FR-23.4).
 */
export async function friendIdsOf(
  service: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data: rows } = await service
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  const ids = new Set(
    (rows ?? []).map((r) =>
      r.requester_id === userId ? (r.addressee_id as string) : (r.requester_id as string),
    ),
  );
  if (ids.size === 0) return [];

  // drop any that block or are blocked by this user
  const { data: blocks } = await service
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  for (const b of blocks ?? []) {
    ids.delete(b.blocker_id as string);
    ids.delete(b.blocked_id as string);
  }
  return [...ids];
}
