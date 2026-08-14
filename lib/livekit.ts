import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  TrackType,
  type VideoGrant,
} from "livekit-server-sdk";
import { identityUserId, livekitIdentity } from "@/lib/livekitIdentity";

export { identityUserId, livekitIdentity };

/**
 * Server-side LiveKit helpers (Phase 5). One LiveKit room per match room;
 * audio only, mic source only — golden rule 1 means no other track source
 * is ever granted.
 */

export function livekitRoomName(roomId: string): string {
  return `match_${roomId}`;
}

/** Every live connection belonging to one account (they may have several). */
async function identitiesFor(
  roomId: string,
  userId: string,
): Promise<string[]> {
  const ps = await roomService().listParticipants(livekitRoomName(roomId));
  return ps
    .filter((p) => identityUserId(p.identity) === userId)
    .map((p) => p.identity);
}

export function roomService(): RoomServiceClient {
  return new RoomServiceClient(
    process.env.LIVEKIT_URL!.replace("wss://", "https://"),
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );
}

export async function mintToken(opts: {
  roomId: string;
  identity: string;
  name: string;
  canPublish: boolean;
}): Promise<string> {
  const grant: VideoGrant = {
    room: livekitRoomName(opts.roomId),
    roomJoin: true,
    canSubscribe: true,
    canPublish: opts.canPublish,
    canPublishData: false,
    canPublishSources: opts.canPublish ? [TrackSource.MICROPHONE] : [],
  };
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: opts.identity,
      name: opts.name,
      ttl: 6 * 60 * 60, // a long match day
    },
  );
  at.addGrant(grant);
  return at.toJwt();
}

/** Live permission change for a connected participant; no-op if they're
 *  not connected (their next token reflects the DB state anyway). */
export async function setPublishPermission(
  roomId: string,
  userId: string,
  canPublish: boolean,
): Promise<boolean> {
  try {
    // an account can hold several connections; elevate/revoke every one of them
    const identities = await identitiesFor(roomId, userId);
    for (const identity of identities) {
      await roomService().updateParticipant(
        livekitRoomName(roomId),
        identity,
        undefined,
        {
          canSubscribe: true,
          canPublish,
          canPublishData: false,
          canPublishSources: canPublish ? [TrackSource.MICROPHONE] : [],
        },
      );
    }
    return true;
  } catch (err) {
    // Report failure instead of swallowing it. The caller may legitimately not
    // be connected (a no-op), but a LiveKit outage looked identical — so the
    // host's end-call X returned 200 while the caller stayed live
    // (audit 2026-08-05).
    console.warn(`updateParticipant(${userId}) skipped:`, (err as Error).message);
    return false;
  }
}

/**
 * Enforce ONE on-air connection per account (founder 2026-08-05). Revokes
 * publish on every other connection this account holds in the room, so a second
 * tab or device can't also open a microphone. The demoted clients get
 * ParticipantPermissionsChanged with canPublish=false, which their audio engine
 * already handles by stopping the mic.
 */
export async function keepOnlyPublisher(
  roomId: string,
  userId: string,
  keepIdentity: string,
): Promise<void> {
  try {
    const others = (await identitiesFor(roomId, userId)).filter(
      (id) => id !== keepIdentity,
    );
    for (const identity of others) {
      await roomService().updateParticipant(
        livekitRoomName(roomId),
        identity,
        undefined,
        {
          canSubscribe: true,
          canPublish: false,
          canPublishData: false,
          canPublishSources: [],
        },
      );
    }
  } catch (err) {
    console.warn("keepOnlyPublisher failed:", (err as Error).message);
  }
}

/** Host control: mute or unmute an on-air guest's microphone server-side
 *  (founder 2026-08-05). Returns false if they have no published audio track. */
export async function muteParticipantMic(
  roomId: string,
  userId: string,
  muted: boolean,
): Promise<boolean> {
  try {
    const svc = roomService();
    const room = livekitRoomName(roomId);
    const participants = await svc.listParticipants(room);
    // mute every connection this account has publishing audio
    const mine = participants.filter(
      (p) => identityUserId(p.identity) === userId,
    );
    let hit = false;
    for (const p of mine) {
      const track = p.tracks?.find((t) => t.type === TrackType.AUDIO);
      if (!track) continue;
      await svc.mutePublishedTrack(room, p.identity, track.sid, muted);
      hit = true;
    }
    return hit;
  } catch (err) {
    console.error("muteParticipantMic failed:", (err as Error).message);
    return false;
  }
}

/** Identities currently connected to the room's LiveKit room. Used to reconcile
 *  the call-in cap: a caller accepted earlier who dropped without Leave Air
 *  leaves a stale 'accepted' talk_request that would permanently consume a cap
 *  slot; before accepting we complete rows whose caller isn't a live participant
 *  so the 2-guest cap reflects who's actually on air (call-in audit 2026-08-05).
 *  Best-effort: returns an empty set on any error. */
/** Accounts currently connected, or NULL if we couldn't find out. Null matters:
 *  an empty set used to be returned on error, and the cap reconcile reads that
 *  as "nobody is on air" — so one LiveKit blip silently completed every live
 *  caller and un-capped the room (audit 2026-08-05). Callers must fail closed. */
export async function connectedIdentities(
  roomId: string,
): Promise<Set<string> | null> {
  try {
    const ps = await roomService().listParticipants(livekitRoomName(roomId));
    // keyed by ACCOUNT, not connection, so callers can test membership with a
    // plain user id
    return new Set(ps.map((p) => identityUserId(p.identity)));
  } catch {
    return null;
  }
}
