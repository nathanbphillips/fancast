import {
  EgressClient,
  S3Upload,
  SegmentedFileOutput,
} from "livekit-server-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { livekitRoomName } from "./livekit";

/**
 * Continuous audio-only HLS egress while live (FR-5.3): LiveKit composites
 * the room mix into rolling HLS segments in Supabase storage (public
 * `radio` bucket); radio mode plays the live playlist in a plain <audio>.
 * Fully gated on the SUPABASE_S3_* env vars — without them the lifecycle
 * proceeds normally and radio mode just stays unavailable.
 */

const BUCKET = "radio";

function s3Configured(): boolean {
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

async function ensureRadioBucket(service: SupabaseClient): Promise<void> {
  const { data } = await service.storage.getBucket(BUCKET);
  if (!data) {
    await service.storage.createBucket(BUCKET, { public: true });
  }
}

/** Returns { egressId, hlsUrl } or null when storage isn't configured. */
export async function startHlsEgress(
  service: SupabaseClient,
  roomId: string,
): Promise<{ egressId: string; hlsUrl: string } | null> {
  if (!s3Configured()) {
    console.warn("HLS egress skipped: SUPABASE_S3_* not configured");
    return null;
  }
  await ensureRadioBucket(service);

  const prefix = `${roomId}`;
  const info = await egressClient().startRoomCompositeEgress(
    livekitRoomName(roomId),
    {
      segments: new SegmentedFileOutput({
        filenamePrefix: `${prefix}/seg`,
        playlistName: `${prefix}/full.m3u8`,
        livePlaylistName: `${prefix}/live.m3u8`,
        segmentDuration: 4,
        output: {
          case: "s3",
          value: new S3Upload({
            endpoint: process.env.SUPABASE_S3_ENDPOINT!,
            accessKey: process.env.SUPABASE_S3_ACCESS_KEY!,
            secret: process.env.SUPABASE_S3_SECRET_KEY!,
            region: process.env.SUPABASE_S3_REGION || "us-east-1",
            bucket: BUCKET,
            forcePathStyle: true,
          }),
        },
      }),
    },
    { audioOnly: true },
  );

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return {
    egressId: info.egressId,
    hlsUrl: `${base}/storage/v1/object/public/${BUCKET}/${prefix}/live.m3u8`,
  };
}

export async function stopHlsEgress(egressId: string): Promise<void> {
  try {
    await egressClient().stopEgress(egressId);
  } catch (err) {
    console.warn(`stopEgress(${egressId}) failed:`, (err as Error).message);
  }
}
