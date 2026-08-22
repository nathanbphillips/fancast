import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
  SegmentedFileOutput,
} from "livekit-server-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { livekitRoomName, roomService } from "./livekit";

/**
 * One room-composite egress while live, two outputs (one composite render,
 * so half the LiveKit cost):
 *  - segments: rolling HLS into the public `radio` bucket (FR-5.3),
 *    purged on End Broadcast so no public copy outlives the live show
 *  - file: a single MP4/AAC of the room mix into the private `recordings`
 *    bucket (FR-13/14), Start->End Broadcast, disconnect-proof
 * Fully gated on SUPABASE_S3_* — without storage the lifecycle proceeds
 * and both radio and recording simply stay unavailable.
 */

const RADIO_BUCKET = "radio";
const REC_BUCKET = "recordings";

export function s3Configured(): boolean {
  return Boolean(
    process.env.SUPABASE_S3_ENDPOINT &&
      process.env.SUPABASE_S3_ACCESS_KEY &&
      process.env.SUPABASE_S3_SECRET_KEY,
  );
}

function egressClient(): EgressClient {
  return new EgressClient(
    process.env.LIVEKIT_URL!.replace("wss://", "https://"),
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );
}

function s3(bucket: string): S3Upload {
  return new S3Upload({
    endpoint: process.env.SUPABASE_S3_ENDPOINT!,
    accessKey: process.env.SUPABASE_S3_ACCESS_KEY!,
    secret: process.env.SUPABASE_S3_SECRET_KEY!,
    region: process.env.SUPABASE_S3_REGION || "us-east-1",
    bucket,
    forcePathStyle: true,
  });
}

async function ensureBucket(
  service: SupabaseClient,
  name: string,
  isPublic: boolean,
): Promise<void> {
  const { data } = await service.storage.getBucket(name);
  if (!data) {
    await service.storage.createBucket(name, { public: isPublic });
    return;
  }
  // re-assert visibility every time — a recordings bucket that was ever
  // made public (manual dashboard toggle, name reuse) must not silently
  // expose recordings (defense in depth for FR-14.2)
  if (data.public !== isPublic) {
    await service.storage.updateBucket(name, { public: isPublic });
  }
}

/** Re-assert that the recordings bucket is private (audit M-C, defense in
 *  depth). The room mix is served only via signed URLs, but a manual dashboard
 *  toggle or bucket-name reuse could flip it public and expose the guessable
 *  /object/public/recordings/{roomId}/full.mp3 path — and a public bucket
 *  bypasses storage RLS entirely, so RLS can't guard this. Re-asserting private
 *  whenever the downloads panel is read (on top of every Start Broadcast)
 *  shrinks the exposure window to "between a toggle and the next read". */
export async function ensureRecordingsPrivate(
  service: SupabaseClient,
): Promise<void> {
  try {
    await ensureBucket(service, REC_BUCKET, false);
  } catch (err) {
    console.warn("ensureRecordingsPrivate failed:", (err as Error).message);
  }
}

/** Remove the entire radio/{roomId}/ prefix from the public bucket.
 *  Called on End Broadcast — radio is live-only. */
export async function purgeRadio(
  service: SupabaseClient,
  roomId: string,
): Promise<void> {
  try {
    // PAGED. list() defaults to 100 rows, so the old single call deleted the
    // first ~100 objects and silently left the rest - a 3h show is ~10,000
    // segments. (That accident preserved the source for the 2026-08-21 rescue,
    // and also ate that show's first 98 seconds.) Loop until the prefix is
    // actually empty.
    for (let round = 0; round < 200; round++) {
      const { data } = await service.storage
        .from(RADIO_BUCKET)
        .list(roomId, { limit: 1000 });
      if (!data?.length) break;
      const { error } = await service.storage
        .from(RADIO_BUCKET)
        .remove(data.map((o) => `${roomId}/${o.name}`));
      if (error) {
        // a failing delete must not spin 200 confident no-op rounds
        console.warn(`purgeRadio(${roomId}): remove failed, aborting: ${error.message}`);
        break;
      }
    }
  } catch (err) {
    console.warn(`purgeRadio(${roomId}) failed:`, (err as Error).message);
  }
}

export type BroadcastEgress = {
  egressId: string;
  hlsUrl: string;
  sourcePath: string | null;
};

/** Start the combined radio + recording egress. Null when storage is
 *  unconfigured. */
export async function startBroadcastEgress(
  service: SupabaseClient,
  roomId: string,
): Promise<BroadcastEgress | null> {
  if (!s3Configured()) {
    console.warn("egress skipped: SUPABASE_S3_* not configured");
    return null;
  }
  await ensureBucket(service, RADIO_BUCKET, true);
  await ensureBucket(service, REC_BUCKET, false);

  // LiveKit creates rooms lazily on first join; egress against a
  // not-yet-existing room 404s, so create it explicitly (idempotent).
  await roomService().createRoom({
    name: livekitRoomName(roomId),
    emptyTimeout: 60 * 60,
  });

  // SEGMENTS ONLY - no MP4 file output (2026-08-22). The egress used to also
  // write one continuously growing broadcast.mp4, and at ~3h its S3 multipart
  // upload crossed the Supabase max-object cap (413 EntityTooLarge). LiveKit
  // treats a failed output as fatal, so it killed the WHOLE egress - the
  // healthy segment output included - and the final 16 minutes of the first
  // real match show were never captured by anything. One-second segments
  // never grow, so no cap can ever kill the recorder again; processing now
  // builds the recording from the segments (lib/recording.ts).
  const info = await egressClient().startRoomCompositeEgress(
    livekitRoomName(roomId),
    {
      segments: new SegmentedFileOutput({
        filenamePrefix: `${roomId}/seg`,
        playlistName: `${roomId}/full.m3u8`,
        livePlaylistName: `${roomId}/live.m3u8`,
        // 1s (was 4, then 2): radio latency is (upload of a finished segment)
        // + (player's live-sync distance), and both scale with this number.
        // Verified live 2026-08-21: 1s segments cut in real time with no
        // backlog, landing the player ~3-5s behind live. Applies from the
        // next egress start.
        segmentDuration: 1,
        output: { case: "s3", value: s3(RADIO_BUCKET) },
      }),
    },
    { audioOnly: true },
  );

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return {
    egressId: info.egressId,
    hlsUrl: `${base}/storage/v1/object/public/${RADIO_BUCKET}/${roomId}/live.m3u8`,
    // legacy field: new recordings are built from the radio segments, so
    // there is no MP4 source object any more
    sourcePath: null as string | null,
  };
}

export async function stopBroadcastEgress(egressId: string): Promise<void> {
  try {
    await egressClient().stopEgress(egressId);
  } catch (err) {
    console.warn(`stopEgress(${egressId}) failed:`, (err as Error).message);
  }
}

/**
 * Disconnect every participant and delete the LiveKit room (M-7, audit). On
 * End Broadcast this forcibly cuts any already-connected listener whose client
 * didn't stop on its own (e.g. tab left open) — deleteRoom fires
 * RoomEvent.Disconnected, which useRoomAudio already handles. Idempotent: a
 * 404 on an already-gone room is fine. MUST be called only AFTER the egress
 * has stopped, or a room-composite egress would be aborted and the recording
 * lost.
 */
export async function deleteBroadcastRoom(roomId: string): Promise<void> {
  try {
    await roomService().deleteRoom(livekitRoomName(roomId));
  } catch (err) {
    console.warn(`deleteRoom(${roomId}) failed:`, (err as Error).message);
  }
}
