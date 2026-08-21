import { EgressClient, EncodedFileOutput, EncodedFileType, SegmentedFileOutput, S3Upload, EgressStatus } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
const ROOM = "cea622f8-d418-418f-ae9f-bf8d840e010c";
const lk = process.env.LIVEKIT_URL!.replace("wss://", "https://");
const s3 = (bucket: string) => new S3Upload({
  endpoint: process.env.SUPABASE_S3_ENDPOINT!, accessKey: process.env.SUPABASE_S3_ACCESS_KEY!,
  secret: process.env.SUPABASE_S3_SECRET_KEY!, region: process.env.SUPABASE_S3_REGION || "us-east-1",
  bucket, forcePathStyle: true,
});
async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: room } = await db.from("rooms").select("state, hls_egress_id").eq("id", ROOM).maybeSingle();
  if (!room || ["wrapped", "canceled"].includes(room.state as string)) { console.log("room gone"); return; }
  const eg = new EgressClient(lk, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
  if (room.hls_egress_id) await eg.stopEgress(room.hls_egress_id as string).catch(() => {});
  const info = await eg.startRoomCompositeEgress(`match_${ROOM}`, {
    segments: new SegmentedFileOutput({
      filenamePrefix: `${ROOM}/seg`, playlistName: `${ROOM}/full.m3u8`,
      livePlaylistName: `${ROOM}/live.m3u8`, segmentDuration: 1,
      output: { case: "s3", value: s3("radio") },
    }),
    file: new EncodedFileOutput({ fileType: EncodedFileType.MP4, filepath: `${ROOM}/broadcast.mp4`, output: { case: "s3", value: s3("recordings") } }),
  }, { audioOnly: true });
  console.log("1s-segment egress:", info.egressId);
  await db.from("rooms").update({ hls_egress_id: info.egressId }).eq("id", ROOM);
  await db.from("recordings").update({ egress_id: info.egressId }).eq("room_id", ROOM);
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const st = (await eg.listEgress({ egressId: info.egressId }))[0]?.status;
    console.log(`  [${i * 3}s] ${st !== undefined ? EgressStatus[st] : "?"}`);
    if (st === EgressStatus.EGRESS_ACTIVE) break;
    if (st === EgressStatus.EGRESS_FAILED) { console.log("FAILED - 1s not accepted"); return; }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
