import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
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
