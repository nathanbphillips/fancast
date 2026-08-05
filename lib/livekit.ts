import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  TrackType,
  type VideoGrant,
} from "livekit-server-sdk";

/**
 * Server-side LiveKit helpers (Phase 5). One LiveKit room per match room;
 * audio only, mic source only — golden rule 1 means no other track source
 * is ever granted.
 */

export function livekitRoomName(roomId: string): string {
  return `match_${roomId}`;
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
  identity: string,
  canPublish: boolean,
): Promise<void> {
  try {
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
  } catch (err) {
    // participant not in the room — fine
    console.warn(`updateParticipant(${identity}) skipped:`, (err as Error).message);
  }
}

/** Host control: mute or unmute an on-air guest's microphone server-side
 *  (founder 2026-08-05). Returns false if they have no published audio track. */
export async function muteParticipantMic(
  roomId: string,
  identity: string,
  muted: boolean,
): Promise<boolean> {
  try {
    const svc = roomService();
    const room = livekitRoomName(roomId);
    const participants = await svc.listParticipants(room);
    const p = participants.find((x) => x.identity === identity);
    const track = p?.tracks?.find((t) => t.type === TrackType.AUDIO);
    if (!track) return false;
    await svc.mutePublishedTrack(room, identity, track.sid, muted);
    return true;
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
export async function connectedIdentities(roomId: string): Promise<Set<string>> {
  try {
    const ps = await roomService().listParticipants(livekitRoomName(roomId));
    return new Set(ps.map((p) => p.identity));
  } catch {
    return new Set();
  }
}
