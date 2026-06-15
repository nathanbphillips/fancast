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

/** Remove the entire radio/{roomId}/ prefix from the public bucket.
 *  Called on End Broadcast — radio is live-only. */
export async function purgeRadio(
  service: SupabaseClient,
  roomId: string,
): Promise<void> {
  try {
    const { data } = await service.storage.from(RADIO_BUCKET).list(roomId);
    if (data?.length) {
      await service.storage
        .from(RADIO_BUCKET)
        .remove(data.map((o) => `${roomId}/${o.name}`));
    }
  } catch (err) {
    console.warn(`purgeRadio(${roomId}) failed:`, (err as Error).message);
  }
}

export type BroadcastEgress = {
  egressId: string;
  hlsUrl: string;
  sourcePath: string;
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

  // both outputs share one composite encode, so they must agree on codec:
  // HLS segments are AAC, so the recording file is MP4/AAC (not OGG/Opus,
  // which would fail "no codec compatible with all outputs"). Processing
  // transcodes the MP4 to MP3 either way.
  const sourcePath = `${roomId}/broadcast.mp4`;
  const info = await egressClient().startRoomCompositeEgress(
    livekitRoomName(roomId),
    {
      segments: new SegmentedFileOutput({
        filenamePrefix: `${roomId}/seg`,
        playlistName: `${roomId}/full.m3u8`,
        livePlaylistName: `${roomId}/live.m3u8`,
        segmentDuration: 4,
        output: { case: "s3", value: s3(RADIO_BUCKET) },
      }),
      file: new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: sourcePath,
        output: { case: "s3", value: s3(REC_BUCKET) },
      }),
    },
    { audioOnly: true },
  );

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return {
    egressId: info.egressId,
    hlsUrl: `${base}/storage/v1/object/public/${RADIO_BUCKET}/${roomId}/live.m3u8`,
    sourcePath,
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
