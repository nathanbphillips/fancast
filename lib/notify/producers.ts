import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueue } from "@/lib/notify/outbox";
import { acceptedHosts } from "@/lib/roomHosts";
import type { NotificationPayload } from "@/lib/notify/render";

/**
 * Notification producers (FR-21): the triggers that enqueue notifications. Each
 * returns the enqueued outbox row ids so the caller can flush immediate types
 * inside after() (send-after-write) or leave scheduled reminders for the
 * drainer. Follower/host resolution and dedupe live here so routes stay thin.
 */

const PRE_START_LEAD_MS = 15 * 60 * 1000;

/** Follower ids of a single commentator. */
async function followersOf(
  service: SupabaseClient,
  hostUserId: string,
): Promise<string[]> {
  const { data } = await service
    .from("follows")
    .select("follower_id")
    .eq("commentator_id", hostUserId);
  return (data ?? []).map((r) => r.follower_id as string);
}

/** Union of followers of every accepted host of a room (deduped). A follower
 *  of both co-hosts appears once; the outbox dedupe_key is the hard backstop. */
async function followersOfRoomHosts(
  service: SupabaseClient,
  roomId: string,
): Promise<string[]> {
  const hosts = await acceptedHosts(service, roomId);
  const set = new Set<string>();
  for (const h of hosts) {
    for (const f of await followersOf(service, h.user_id)) set.add(f);
  }
  return [...set];
}

/** room_scheduled to a host's followers (single room, on creation). */
export async function enqueueRoomScheduled(
  service: SupabaseClient,
  opts: {
    roomId: string;
    hostUserId: string;
    payload: NotificationPayload;
  },
): Promise<string[]> {
  const recipients = await followersOf(service, opts.hostUserId);
  if (recipients.length === 0) return [];
  return enqueue(service, {
    type: "room_scheduled",
    recipientIds: recipients,
    roomId: opts.roomId,
    actorId: opts.hostUserId,
    payload: opts.payload,
  });
}

/** room_scheduled as ONE season summary per follower (FR-20.7 / FR-21.3). */
export async function enqueueSeasonSummary(
  service: SupabaseClient,
  opts: {
    hostUserId: string;
    subscriptionId: string;
    payload: NotificationPayload;
  },
): Promise<string[]> {
  const recipients = await followersOf(service, opts.hostUserId);
  if (recipients.length === 0) return [];
  return enqueue(service, {
    type: "room_scheduled",
    recipientIds: recipients,
    roomId: null,
    actorId: opts.hostUserId,
    dedupeScope: `sub:${opts.subscriptionId}`,
    payload: opts.payload,
  });
}

/** go_live to the followers of every accepted host (keeps FR-1.4). */
export async function enqueueGoLive(
  service: SupabaseClient,
  opts: { roomId: string; payload: NotificationPayload },
): Promise<string[]> {
  const recipients = await followersOfRoomHosts(service, opts.roomId);
  if (recipients.length === 0) return [];
  return enqueue(service, {
    type: "go_live",
    recipientIds: recipients,
    roomId: opts.roomId,
    payload: opts.payload,
  });
}

/** pre_start_reminder to followers, due 15 min before broadcast_start. Skipped
 *  when the lead time has already passed. */
export async function enqueuePreStartReminders(
  service: SupabaseClient,
  opts: {
    roomId: string;
    hostUserId: string;
    broadcastStart: string;
    payload: NotificationPayload;
  },
): Promise<string[]> {
  const dueAt = new Date(
    new Date(opts.broadcastStart).getTime() - PRE_START_LEAD_MS,
  );
  if (dueAt.getTime() <= Date.now()) return [];
  const recipients = await followersOf(service, opts.hostUserId);
  if (recipients.length === 0) return [];
  return enqueue(service, {
    type: "pre_start_reminder",
    recipientIds: recipients,
    roomId: opts.roomId,
    actorId: opts.hostUserId,
    dueAt,
    payload: opts.payload,
  });
}

/** room_change to a fixed recipient set (hosts now; RSVP holders join in
 *  PRD-05). Immediate. */
export async function enqueueRoomChange(
  service: SupabaseClient,
  opts: {
    roomId: string;
    recipientIds: string[];
    payload: NotificationPayload;
  },
): Promise<string[]> {
  if (opts.recipientIds.length === 0) return [];
  return enqueue(service, {
    type: "room_change",
    recipientIds: opts.recipientIds,
    roomId: opts.roomId,
    // change events supersede a pending same-room change: scope by change kind
    dedupeScope: `${opts.roomId}:${opts.payload.change ?? "change"}`,
    payload: opts.payload,
  });
}
