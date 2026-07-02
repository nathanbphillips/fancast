import Ably from "ably";

/**
 * Server-side Ably REST client. Golden rule 5: the DB is the source of
 * truth and Ably is transport — API routes persist first, then publish.
 * Clients hold subscribe/presence-only tokens (see /api/ably/token) and
 * never publish directly.
 */

let rest: Ably.Rest | null = null;

export function ablyRest(): Ably.Rest {
  if (!rest) {
    const key = process.env.ABLY_API_KEY;
    if (!key) throw new Error("ABLY_API_KEY is not set");
    rest = new Ably.Rest({ key });
  }
  return rest;
}

/** Channel names per docs/ARCHITECTURE.md. */
export const channels = {
  chat: (roomId: string) => `room:${roomId}:chat`,
  links: (roomId: string) => `room:${roomId}:links`,
  control: (roomId: string) => `room:${roomId}:control`,
  /** ephemeral floating-reaction emoji — no DB, published server-side, clients
   *  subscribe only. Never rehydrated on reconnect (Phase 5a). */
  reactions: (roomId: string) => `room:${roomId}:reactions`,
  private: (roomId: string) => `room:${roomId}:private`,
  /** per-user channel: only that signed-in user holds the token capability,
   *  used for resolutions that must reach one requester without broadcasting
   *  their identity to every listener on the control channel (FR-4.2). */
  userPrivate: (roomId: string, userId: string) => `room:${roomId}:user:${userId}`,
};

/** Publish an event; failures are logged, not thrown — the DB write
 *  already succeeded and clients recover via history replay. */
export async function publish(
  channel: string,
  event: string,
  data: unknown,
): Promise<void> {
  try {
    await ablyRest().channels.get(channel).publish(event, data);
  } catch (err) {
    console.error(`ably publish failed on ${channel}/${event}:`, err);
  }
}
