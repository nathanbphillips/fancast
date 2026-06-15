import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { crc32 } from "node:zlib";
import ffmpegPath from "ffmpeg-static";
import { EgressClient, EgressStatus } from "livekit-server-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/server";
import { deleteBroadcastRoom } from "@/lib/egress";
import { deriveSegments, type Marker } from "@/lib/markers";

const run = promisify(execFile);
const REC_BUCKET = "recordings";
const FFMPEG = (ffmpegPath as unknown as string) || "ffmpeg";
// a processing run older than this is presumed dead (crash/timeout) and
// may be reclaimed
const STALE_PROCESSING_MS = 10 * 60 * 1000;

/**
 * Post-session processing (FR-13.5/13.7). On End Broadcast the MP4/AAC room
 * mix is finalized by egress (MP4 not OGG — codec-compatible with the HLS
 * radio output of the same composite); this transcodes it to a full MP3,
 * cuts one MP3 per segment at marker offsets (stream-copy — I/O bound,
 * fast), zips everything, and records segment rows. Target <15 min.
 *
 * Concurrency: an atomic status claim serializes runs and lets a crashed
 * run be reclaimed after STALE_PROCESSING_MS. NOTE (decision log): a full
 * 90-min transcode may exceed the serverless time limit — move to a worker
 * if that bites; fine for test-length sessions.
 */

/** Fire-and-forget trigger from a request handler (uses next/server after
 *  so the response returns immediately; the panel polls status). */
export function triggerProcessing(roomId: string): void {
  void (async () => {
    try {
      const { after } = await import("next/server");
      after(async () => {
        await processRecording(createServiceClient(), roomId).catch((e) =>
          console.error("recording processing failed:", e),
        );
      });
    } catch {
      // outside a request scope (scripts) — run inline
      void processRecording(createServiceClient(), roomId).catch((e) =>
        console.error("recording processing failed:", e),
      );
    }
  })();
}

function egressClient(): EgressClient {
  return new EgressClient(
    process.env.LIVEKIT_URL!.replace("wss://", "https://"),
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait for the egress to finish writing the recording to storage.
 *  Returns { ok } with a reason so a slow finalize and a hard failure are
 *  distinguishable to the caller. */
async function waitForEgress(
  egressId: string,
  timeoutMs = 180_000,
): Promise<{ ok: boolean; reason?: string }> {
  const client = egressClient();
  const deadline = Date.now() + timeoutMs;
  let lastErr = "";
  while (Date.now() < deadline) {
    try {
      const list = await client.listEgress({ egressId });
      const info = list[0];
      if (info) {
        if (info.status === EgressStatus.EGRESS_COMPLETE) return { ok: true };
        if (
          info.status === EgressStatus.EGRESS_FAILED ||
          info.status === EgressStatus.EGRESS_ABORTED
        ) {
          return { ok: false, reason: `egress ${EgressStatus[info.status]}` };
        }
      }
    } catch (e) {
      lastErr = (e as Error).message;
      console.warn("listEgress poll failed:", lastErr);
    }
    await sleep(3000);
  }
  return {
    ok: false,
    reason: lastErr
      ? `egress status unknown (${lastErr})`
      : "egress still finalizing — try again shortly",
  };
}

export async function processRecording(
  service: SupabaseClient,
  roomId: string,
): Promise<{ status: string; segments: number }> {
  // atomic claim: flip to 'processing' only if not already being processed
  // (or the prior run is stale). A failed claim means another run owns it.
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { data: rec } = await service
    .from("recordings")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      error: null,
    })
    .eq("room_id", roomId)
    .or(`status.neq.processing,processing_started_at.lt.${staleBefore}`)
    .select("*")
    .maybeSingle();
  if (!rec) {
    const { data: existing } = await service
      .from("recordings")
      .select("status")
      .eq("room_id", roomId)
      .maybeSingle();
    return { status: existing ? "busy" : "missing", segments: 0 };
  }

  const fail = async (error: string) => {
    await service
      .from("recordings")
      .update({ status: "failed", error })
      .eq("id", rec.id);
    return { status: "failed", segments: 0 };
  };

  if (rec.egress_id) {
    const egress = await waitForEgress(rec.egress_id);
    if (!egress.ok) return fail(egress.reason ?? "egress did not complete");
  }

  // Egress is terminal and the MP4 is flushed, so it's now safe to delete the
  // LiveKit room — disconnecting any lingering listener (M-7, audit). Gated on
  // the egress-ok path above so the recording is never aborted. Idempotent, so
  // a recut re-entering here is harmless.
  await deleteBroadcastRoom(roomId);

  // per-run unique temp dir so concurrent/sequential runs never share files
  const work = await mkdtemp(join(tmpdir(), `fc-rec-${roomId}-`));
  const sourceLocal = join(work, "source.mp4");
  const fullLocal = join(work, "full.mp3");

  try {
    // download the MP4 room mix
    const { data: blob, error: dlErr } = await service.storage
      .from(REC_BUCKET)
      .download(rec.source_path!);
    if (dlErr || !blob) return fail(`source download failed: ${dlErr?.message}`);
    const bytes = Buffer.from(await blob.arrayBuffer());
    // a real MP4 with audio is many KB even for a short clip; a tiny file
    // means egress captured nothing
    if (bytes.length < 4096) return markEmpty(service, rec.id);
    await writeFile(sourceLocal, bytes);

    // one-time transcode to the headline full MP3
    await run(FFMPEG, ["-y", "-i", sourceLocal, "-c:a", "libmp3lame", "-q:a", "4", fullLocal]);
    const fullBuf = await readFile(fullLocal);
    // a near-empty transcode (no real audio) also means an empty session
    if (fullBuf.length < 2048) return markEmpty(service, rec.id);
    const fullPath = `${roomId}/full.mp3`;
    const up = await service.storage
      .from(REC_BUCKET)
      .upload(fullPath, fullBuf, { contentType: "audio/mpeg", upsert: true });
    if (up.error) return fail(`full upload failed: ${up.error.message}`);

    // derive segments from markers
    const { data: markers } = await service
      .from("broadcast_markers")
      .select("kind, label, server_ts, adjusted_ts")
      .eq("room_id", roomId);
    const startMs = new Date(rec.started_at).getTime();
    const endMs = new Date(rec.ended_at ?? rec.started_at).getTime();
    const segments = deriveSegments(
      (markers ?? []) as Pick<Marker, "kind" | "label" | "server_ts" | "adjusted_ts">[],
      startMs,
      endMs,
    );

    // cut each segment by stream-copy, upload, collect for the zip
    await service.from("recording_segments").delete().eq("recording_id", rec.id);
    const zipEntries: { name: string; data: Buffer }[] = [{ name: "full.mp3", data: fullBuf }];
    for (const seg of segments) {
      const local = join(work, `seg-${seg.idx}.mp3`);
      await run(FFMPEG, [
        "-y",
        "-ss", String(seg.startOffset),
        "-to", String(seg.endOffset),
        "-i", fullLocal,
        "-c", "copy",
        local,
      ]);
      const buf = await readFile(local);
      const storagePath = `${roomId}/seg-${seg.idx}.mp3`;
      const segUp = await service.storage
        .from(REC_BUCKET)
        .upload(storagePath, buf, { contentType: "audio/mpeg", upsert: true });
      if (segUp.error) return fail(`segment upload failed: ${segUp.error.message}`);
      await service.from("recording_segments").insert({
        recording_id: rec.id,
        idx: seg.idx,
        label: seg.label,
        start_offset: seg.startOffset,
        end_offset: seg.endOffset,
        storage_path: storagePath,
        size_bytes: buf.length,
        duration_seconds: seg.endOffset - seg.startOffset,
      });
      zipEntries.push({ name: `${String(seg.idx).padStart(2, "0")} ${seg.label}.mp3`, data: buf });
    }

    // zip everything for one-click download — non-fatal: a zip hiccup
    // must not deny the commentator the individual MP3s
    let zipPath: string | null = null;
    try {
      const zipBuf = buildZipStore(zipEntries);
      zipPath = `${roomId}/all.zip`;
      await service.storage
        .from(REC_BUCKET)
        .upload(zipPath, zipBuf, { contentType: "application/zip", upsert: true });
    } catch (e) {
      console.error("zip failed (segments still available):", (e as Error).message);
      zipPath = null;
    }

    await service
      .from("recordings")
      .update({
        status: "ready",
        full_mp3_path: fullPath,
        zip_path: zipPath,
        duration_seconds: Math.max(0, (endMs - startMs) / 1000),
      })
      .eq("id", rec.id);

    return { status: "ready", segments: segments.length };
  } catch (e) {
    return fail((e as Error).message);
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

async function markEmpty(service: SupabaseClient, recId: string) {
  await service.from("recordings").update({ status: "empty" }).eq("id", recId);
  return { status: "empty", segments: 0 };
}

/**
 * Minimal ZIP writer, STORE method (no compression — MP3/AAC are already
 * compressed). Dependency-free: archiver's CJS export fought every Next
 * bundler interop, and a stored zip is a few dozen lines. ASCII filenames.
 */
function buildZipStore(entries: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data) >>> 0;
    const size = e.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header sig
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x21, 12); // mod date (1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra len
    locals.push(local, name, e.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central dir sig
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    centrals.push(central, name);

    offset += local.length + name.length + e.data.length;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central dir sig
  end.writeUInt16LE(entries.length, 8); // entries this disk
  end.writeUInt16LE(entries.length, 10); // total entries
  end.writeUInt32LE(centralBuf.length, 12); // central dir size
  end.writeUInt32LE(centralStart, 16); // central dir offset
  return Buffer.concat([...locals, centralBuf, end]);
}
