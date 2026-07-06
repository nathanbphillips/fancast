import type { SupabaseClient } from "@supabase/supabase-js";
import {
  enqueue,
  flushRows,
  purgeUnsentRoomReminders,
} from "@/lib/notify/outbox";
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
    // one-shot per room: a revive must not re-announce (review 2026-07-03)
    oncePerScope: true,
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
    oncePerScope: true,
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
    // one-shot per room lifetime
    oncePerScope: true,
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

/** rsvp_reminder to one RSVP holder, due 30 min before broadcast_start
 *  (FR-22.1). Skipped when the lead time has already passed. */
const RSVP_LEAD_MS = 30 * 60 * 1000;
export async function enqueueRsvpReminder(
  service: SupabaseClient,
  opts: {
    roomId: string;
    userId: string;
    broadcastStart: string | null;
    payload: NotificationPayload;
  },
): Promise<string[]> {
  if (!opts.broadcastStart) return [];
  const dueAt = new Date(
    new Date(opts.broadcastStart).getTime() - RSVP_LEAD_MS,
  );
  if (dueAt.getTime() <= Date.now()) return [];
  return enqueue(service, {
    type: "rsvp_reminder",
    recipientIds: [opts.userId],
    roomId: opts.roomId,
    dueAt,
    payload: opts.payload,
  });
}

/** cohost_invite to the invitee (FR-25.1). Immediate. */
export async function enqueueCohostInvite(
  service: SupabaseClient,
  opts: {
    roomId: string;
    inviteeId: string;
    inviterId: string;
    payload: NotificationPayload;
  },
): Promise<string[]> {
  return enqueue(service, {
    type: "cohost_invite",
    recipientIds: [opts.inviteeId],
    roomId: opts.roomId,
    actorId: opts.inviterId,
    // scope by the invitee too: inviting B then C, or re-inviting after a
    // sent decline, must not dedupe each other (review 2026-07-03)
    dedupeScope: `cohost:${opts.roomId}:${opts.inviteeId}`,
    payload: opts.payload,
  });
}

/** cohost_response to the original inviter (FR-25.1). Immediate. */
export async function enqueueCohostResponse(
  service: SupabaseClient,
  opts: {
    roomId: string;
    inviterId: string;
    responderId: string;
    payload: NotificationPayload;
  },
): Promise<string[]> {
  return enqueue(service, {
    type: "cohost_response",
    recipientIds: [opts.inviterId],
    roomId: opts.roomId,
    actorId: opts.responderId,
    dedupeScope: `cohostresp:${opts.roomId}:${opts.responderId}`,
    payload: opts.payload,
  });
}

/** friend_request to the addressee (FR-23). Immediate. */
export async function enqueueFriendRequest(
  service: SupabaseClient,
  opts: { addresseeId: string; requesterId: string; requesterName: string },
): Promise<string[]> {
  return enqueue(service, {
    type: "friend_request",
    recipientIds: [opts.addresseeId],
    roomId: null,
    actorId: opts.requesterId,
    dedupeScope: `friend:${opts.requesterId}`,
    payload: { actorName: opts.requesterName },
  });
}

/** friend_accept to the original requester (FR-23). Immediate. */
export async function enqueueFriendAccept(
  service: SupabaseClient,
  opts: {
    requesterId: string;
    accepterId: string;
    accepterName: string;
  },
): Promise<string[]> {
  return enqueue(service, {
    type: "friend_accept",
    recipientIds: [opts.requesterId],
    roomId: null,
    actorId: opts.accepterId,
    dedupeScope: `friend:${opts.accepterId}`,
    payload: {
      actorName: opts.accepterName,
      profileUsername: opts.accepterName,
    },
  });
}

/** room_change to a fixed recipient set (hosts + RSVP holders). Immediate. */
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

/**
 * Cancellation notifications (FR-19.7 x FR-21): room_change("canceled") to
 * each room's RSVP holders + co-hosts, excluding the acting host. Shared by
 * the single-cancel, bulk-cancel, and unsubscribe routes; call inside after()
 * so a notification failure never blocks the cancel itself. Per-room rows for
 * now (dedupe-keyed); collapsing a bulk cancel to one summary per recipient
 * (FR-20.7) is a follow-up once volumes make it matter.
 */
export async function notifyRoomsCanceled(
  service: SupabaseClient,
  roomIds: string[],
  actorId: string | null,
): Promise<void> {
  for (const roomId of roomIds) {
    try {
      // a canceled room's pending pre-start/RSVP reminders must not fire (they
      // would arrive for a dead room, or wrong-time after a revive; review
      // 2026-07-06)
      await purgeUnsentRoomReminders(service, roomId);

      const { data: room } = await service
        .from("rooms")
        .select("id, slug, fixture:fixtures(home_team, away_team)")
        .eq("id", roomId)
        .maybeSingle();
      if (!room) continue;
      const fixture = room.fixture as unknown as {
        home_team: string;
        away_team: string;
      } | null;
      const matchLabel = fixture
        ? `${fixture.home_team} vs ${fixture.away_team}`
        : "Your room";

      const hosts = await acceptedHosts(service, roomId);
      const { data: rsvps } = await service
        .from("room_rsvps")
        .select("user_id")
        .eq("room_id", roomId);
      const recipients = [
        ...new Set([
          ...hosts.map((h) => h.user_id),
          ...(rsvps ?? []).map((r) => r.user_id as string),
        ]),
      ].filter((id) => id !== actorId);

      const ids = await enqueueRoomChange(service, {
        roomId,
        recipientIds: recipients,
        payload: {
          matchLabel,
          roomSlug: (room.slug as string | null) ?? undefined,
          change: "canceled",
        },
      });
      await flushRows(service, ids);
    } catch {
      // never let a notification failure surface into the cancel path
    }
  }
}
