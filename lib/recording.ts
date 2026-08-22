import { execFile } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

/**
 * Is the ffmpeg binary actually present and RUNNABLE in the calling function's
 * bundle? Exported so each route that spawns ffmpeg can answer for its OWN
 * bundle: `outputFileTracingIncludes` is keyed per route, so a probe living
 * anywhere else proves nothing about this one. This is the failure that ate the
 * first live test's recording ("spawn ... ENOENT") and it cannot be reproduced
 * locally, where the binary is always present.
 */
export async function ffmpegProbe(): Promise<{
  ok: boolean;
  stage: string;
  path?: string;
  bytes?: number;
  version?: string;
  error?: string;
  ms: number;
}> {
  const started = Date.now();
  const ms = () => Date.now() - started;
  if (!ffmpegPath) {
    return { ok: false, stage: "resolve", error: "ffmpeg-static exported no path", ms: ms() };
  }
  try {
    const { existsSync, statSync } = await import("node:fs");
    if (!existsSync(FFMPEG)) {
      return { ok: false, stage: "exists", path: FFMPEG, error: "binary not in the function bundle", ms: ms() };
    }
    // resolving and existing is not the same as runnable: the executable bit is
    // the classic casualty of a repacked Linux bundle, so actually run it
    const { stdout } = await run(FFMPEG, ["-version"], { timeout: 10_000 });
    return {
      ok: true,
      stage: "exec",
      path: FFMPEG,
      bytes: statSync(FFMPEG).size,
      version: String(stdout).split("\n")[0] ?? "",
      ms: ms(),
    };
  } catch (err) {
    return { ok: false, stage: "exec", path: FFMPEG, error: (err as Error).message, ms: ms() };
  }
}
// a processing run older than this is presumed dead (crash/timeout) and
// may be reclaimed
const STALE_PROCESSING_MS = 10 * 60 * 1000;

/**
 * Post-session processing (FR-13.5/13.7). Since 2026-08-22 the source is the
 * per-second HLS segments the egress uploaded all show (byte-concatenated -
 * durable the moment they are captured); rows from before then keep their
 * legacy broadcast.mp4 path. The source is transcoded to a full MP3, cut into
 * one MP3 per marker segment (stream-copy - I/O bound, fast), zipped when it
 * fits, and measured before anything is called ready. Target <15 min.
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

/**
 * Measure what is actually in a produced MP3: how long it is, and how much of
 * that is not silence. One decode-only pass, both filters chained.
 *
 * This exists because nothing else in the pipeline ever looked at the audio.
 * duration_seconds is the span between broadcast markers, so a capture that
 * dies 100 seconds in still reports the full show length and still says
 * "ready" - which is exactly what happened to the Betis broadcast.
 */
async function measureAudio(
  file: string,
): Promise<{ seconds: number; audible: number; meanDb: number | null }> {
  // ffmpeg writes its analysis to stderr and exits 0; -f null discards output
  let stderr = "";
  try {
    ({ stderr } = await run(
      FFMPEG,
      ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-45dB:d=1,volumedetect", "-f", "null", "-"],
      { timeout: 240_000, maxBuffer: 1 << 26 },
    ));
  } catch (e) {
    stderr = String((e as { stderr?: string }).stderr ?? "");
  }

  const hms = (h: string, m: string, s: string) => Number(h) * 3600 + Number(m) * 60 + Number(s);
  const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  // the final "time=" line is where decoding actually stopped, which beats the
  // container header when a file is truncated mid-write
  const timeMatches = [...stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
  const last = timeMatches[timeMatches.length - 1];
  const seconds = last
    ? hms(last[1], last[2], last[3])
    : durMatch
      ? hms(durMatch[1], durMatch[2], durMatch[3])
      : 0;

  const silent = [...stderr.matchAll(/silence_duration:\s*([\d.]+)/g)].reduce(
    (a, m) => a + Number(m[1]),
    0,
  );
  const meanRaw = stderr.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1];
  return {
    seconds,
    audible: Math.max(0, seconds - silent),
    meanDb: meanRaw ? Number(meanRaw) : null,
  };
}

/** Parse duration/silence/volume out of an encode pass that carried the
 *  measurement filters, so long shows only decode once. */
function parseMeasure(
  stderr: string,
): { seconds: number; audible: number; meanDb: number | null } | null {
  if (!stderr) return null;
  const hms = (h: string, m: string, s: string) => Number(h) * 3600 + Number(m) * 60 + Number(s);
  const times = [...stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
  const last = times[times.length - 1];
  if (!last) return null;
  const seconds = hms(last[1], last[2], last[3]);
  const silent = [...stderr.matchAll(/silence_duration:\s*([\d.]+)/g)].reduce((a, m) => a + Number(m[1]), 0);
  const meanRaw = stderr.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1];
  return { seconds, audible: Math.max(0, seconds - silent), meanDb: meanRaw ? Number(meanRaw) : null };
}

/**
 * Does the produced audio plausibly represent the broadcast? Returns a reason
 * when it does not. Two independent failures, because they look nothing alike:
 * a capture that stops early is SHORT, and a capture that stays connected but
 * receives nothing is full-length and SILENT.
 */
export function integrityProblem(
  measured: { seconds: number; audible: number; meanDb: number | null },
  expectedSeconds: number,
): string | null {
  const fmt = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)}s`);
  // only judge length when we know what to expect and the show was long enough
  // for a shortfall to be unambiguous rather than marker jitter
  if (expectedSeconds > 120 && measured.seconds < expectedSeconds * 0.5) {
    return `only ${fmt(measured.seconds)} of audio was captured for a ${fmt(expectedSeconds)} broadcast - the recorder stopped early`;
  }
  if (measured.meanDb !== null && measured.meanDb < -60) {
    return `the recording is silent (mean ${measured.meanDb.toFixed(0)} dB) - the recorder stayed connected but received no audio`;
  }
  if (measured.seconds > 60 && measured.audible < measured.seconds * 0.02) {
    return `almost none of the ${fmt(measured.seconds)} recorded is audible (${fmt(measured.audible)}) - the recorder lost the microphone`;
  }
  return null;
}

const RADIO_BUCKET = "radio";
// fewer surviving seconds than this means nothing was really captured
const MIN_SEGMENTS = 5;

/**
 * The per-second HLS segments in the radio bucket, in playback order. Since
 * 2026-08-22 these ARE the recording source: the egress no longer writes a
 * growing MP4 (whose size-cap failure at ~3h killed the whole recorder and
 * the last 16 minutes of the first real match show). Segments upload every
 * second while live, so whatever the recorder captured is durable the moment
 * it happens.
 */
async function listRadioSegments(
  service: SupabaseClient,
  roomId: string,
): Promise<string[]> {
  const names: string[] = [];
  for (let page = 0; page < 40; page++) {
    let data: { name: string; metadata: unknown }[] | null = null;
    let error: { message: string } | null = null;
    // a transient list error must not read as end-of-list: a first-page blip
    // would mark a real recording "empty", a mid-page one would truncate it
    for (let attempt = 0; attempt < 3; attempt++) {
      ({ data, error } = (await service.storage
        .from(RADIO_BUCKET)
        .list(roomId, { limit: 1000, offset: page * 1000 })) as never);
      if (!error) break;
      await sleep(400 * (attempt + 1));
    }
    if (error) throw new Error(`segment listing failed: ${error.message}`);
    if (!data?.length) break;
    for (const o of data) {
      if (/^seg_\d+\.ts$/.test(o.name) && ((o.metadata as { size?: number } | null)?.size ?? 0) > 0) {
        names.push(o.name);
      }
    }
    if (data.length < 1000) break;
  }
  return names.sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
}

/** Is the egress source MP4 already sitting in storage, with bytes in it? */
async function sourceObjectExists(
  service: SupabaseClient,
  sourcePath: string | null,
): Promise<boolean> {
  if (!sourcePath || !sourcePath.includes("/")) return false;
  const dir = sourcePath.slice(0, sourcePath.lastIndexOf("/"));
  const name = sourcePath.slice(sourcePath.lastIndexOf("/") + 1);
  try {
    const { data } = await service.storage.from(REC_BUCKET).list(dir, { limit: 100 });
    const hit = (data ?? []).find((o) => o.name === name);
    return !!hit && ((hit.metadata as { size?: number } | null)?.size ?? 0) > 0;
  } catch {
    return false;
  }
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

  // A RECUT that fails must never hide a recording that was already good:
  // restore the prior terminal status instead of flipping ready -> failed
  // (review 2026-08-22: a marker nudge after the radio sweep would otherwise
  // bury every existing download behind a failed banner).
  const priorStatus = rec.status as string;
  const failStatus = ["ready", "damaged"].includes(priorStatus) ? priorStatus : "failed";
  const fail = async (error: string) => {
    console.error(`recording ${rec.id}: ${error}${failStatus !== "failed" ? " (prior files kept)" : ""}`);
    const { error: upErr } = await service
      .from("recordings")
      .update({ status: failStatus, error: failStatus === "failed" ? error : null })
      .eq("id", rec.id);
    if (upErr) console.error(`recording ${rec.id}: status write failed too: ${upErr.message}`);
    return { status: failStatus, segments: 0 };
  };

  // NEVER process a room that is still broadcasting: the manual "process"
  // action used to be able to reach deleteBroadcastRoom mid-show and cut every
  // listener off a LIVE broadcast (review 2026-08-22). The 'end' action flips
  // state to wrapped before triggering, so the normal path is unaffected.
  const { data: roomRow } = await service
    .from("rooms")
    .select("state")
    .eq("id", roomId)
    .maybeSingle<{ state: string }>();
  if (roomRow && !["wrapped", "canceled"].includes(roomRow.state)) {
    return fail("the broadcast is still live - end it before processing");
  }

  // Legacy rows (pre-2026-08-22) have a broadcast.mp4; new recordings build
  // from the radio segments. The egress wait only exists to know the recorder
  // has flushed its tail - and if it FAILED or its history was pruned, the
  // segments already in storage are still a valid (possibly truncated) source,
  // so a dead egress downgrades to a warning instead of killing the run. That
  // makes the 2026-08-21 manual rescue automatic.
  const legacySource = await sourceObjectExists(service, rec.source_path);
  if (rec.egress_id && !legacySource) {
    const egress = await waitForEgress(rec.egress_id);
    if (!egress.ok) {
      const survivors = await listRadioSegments(service, roomId).catch(() => []);
      if (survivors.length < MIN_SEGMENTS) {
        return fail(egress.reason ?? "egress did not complete");
      }
      console.warn(
        `recording ${rec.id}: egress not clean (${egress.reason}); building from ${survivors.length} surviving segments`,
      );
    }
  }

  // Egress is terminal and the MP4 is flushed, so it's now safe to delete the
  // LiveKit room — disconnecting any lingering listener (M-7, audit). Gated on
  // the egress-ok path above so the recording is never aborted. Idempotent, so
  // a recut re-entering here is harmless.
  await deleteBroadcastRoom(roomId);

  // per-run unique temp dir so concurrent/sequential runs never share files
  const work = await mkdtemp(join(tmpdir(), `fc-rec-${roomId}-`));
  const sourceLocal = join(work, legacySource ? "source.mp4" : "source.ts");
  const fullLocal = join(work, "full.mp3");
  // wall-offset -> audio-offset mapping; identity for the legacy MP4 path
  let presentBefore: (wallOffsetS: number) => number = (s) => s;

  try {
    if (legacySource) {
      // legacy path: the room-mix MP4 from a pre-2026-08-22 egress
      const { data: blob, error: dlErr } = await service.storage
        .from(REC_BUCKET)
        .download(rec.source_path!);
      if (dlErr || !blob) return fail(`source download failed: ${dlErr?.message}`);
      const bytes = Buffer.from(await blob.arrayBuffer());
      if (bytes.length < 4096) return markEmpty(service, rec.id);
      await writeFile(sourceLocal, bytes);
    } else {
      // Segment path: append the per-second MPEG-TS files in playback order.
      // Plain byte concatenation is valid for contiguous TS from one muxer,
      // and appending as we go means /tmp never holds a second copy.
      let names: string[];
      try {
        names = await listRadioSegments(service, roomId);
      } catch (e) {
        return fail((e as Error).message);
      }
      if (names.length < MIN_SEGMENTS) return markEmpty(service, rec.id);
      // Gap awareness (review 2026-08-22): markers are wall-clock, audio time
      // is "seconds actually present". Missing indices (storage holes or
      // skipped downloads) compress the audio, so every marker offset is
      // remapped through a present-before count further down.
      const presentIdx = names.map((n) => Number(n.match(/\d+/)![0]));
      const firstIdx = presentIdx[0];
      presentBefore = (wallOffsetS: number) => {
        const target = firstIdx + wallOffsetS;
        // count of present segments with index < target = audio seconds before
        let lo = 0, hi = presentIdx.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (presentIdx[mid] < target) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      };
      await writeFile(sourceLocal, Buffer.alloc(0));
      let missing = 0;
      const BATCH = 24;
      for (let i = 0; i < names.length; i += BATCH) {
        const batch = names.slice(i, i + BATCH);
        const bufs = await Promise.all(
          batch.map(async (n) => {
            for (let attempt = 0; attempt < 3; attempt++) {
              const { data } = await service.storage
                .from(RADIO_BUCKET)
                .download(`${roomId}/${n}`);
              if (data) {
                const b = Buffer.from(await data.arrayBuffer());
                if (b.length > 0) return b;
              }
              await sleep(200 * (attempt + 1));
            }
            return null;
          }),
        );
        for (const b of bufs) {
          if (b) await appendFile(sourceLocal, b);
          else missing++;
        }
        // a few unfetchable seconds is a warning; a large hole must never be
        // handed to a host labelled "ready"
        if (missing > Math.max(20, names.length * 0.02)) {
          return fail(`${missing} segments unreadable while rebuilding the source`);
        }
      }
      if (missing > 0) {
        console.warn(`recording ${rec.id}: proceeding without ${missing} unreadable segment(s) (~${missing}s)`);
      }
    }

    // One-time transcode to the headline full MP3, WITH the integrity
    // measurement in the same pass (silencedetect+volumedetect run pre-encode,
    // saving a whole second decode of a 3h show against the 300s wall).
    // Cap discipline (Supabase Free: 50MB/object, the cap that killed the old
    // MP4 pipeline): short shows keep q4 stereo; anything longer goes q7 MONO,
    // which keeps a 2h cut near 43MB and also encodes ~1.3x faster.
    const roughSpanS = rec.ended_at
      ? (new Date(rec.ended_at).getTime() - new Date(rec.started_at).getTime()) / 1000
      : 0;
    const shortShow = roughSpanS > 0 && roughSpanS <= 25 * 60;
    const encodeArgs = shortShow
      ? ["-c:a", "libmp3lame", "-q:a", "4"]
      : ["-ac", "1", "-c:a", "libmp3lame", "-q:a", "7"];
    let encodeStderr = "";
    try {
      ({ stderr: encodeStderr } = await run(
        FFMPEG,
        ["-y", "-i", sourceLocal, "-af", "silencedetect=noise=-45dB:d=1,volumedetect", ...encodeArgs, fullLocal],
        { timeout: 280_000, maxBuffer: 1 << 26 },
      ));
    } catch (e) {
      const es = String((e as { stderr?: string }).stderr ?? "");
      if (!es.includes("volumedetect")) throw e;
      encodeStderr = es;
    }
    // /tmp is 500MB and a 3h source is ~250MB: drop it the moment the MP3
    // exists (everything downstream cuts from fullLocal)
    await rm(sourceLocal, { force: true }).catch(() => {});
    const fullBuf = await readFile(fullLocal);
    // a near-empty transcode (no real audio) also means an empty session
    if (fullBuf.length < 2048) return markEmpty(service, rec.id);
    const fullPath = `${roomId}/full.mp3`;
    let up = await service.storage
      .from(REC_BUCKET)
      .upload(fullPath, fullBuf, { contentType: "audio/mpeg", upsert: true });
    const isSizeError = (m: string) => /maximum allowed size|EntityTooLarge|exceeded|too large|413/i.test(m);
    if (up.error && !isSizeError(up.error.message)) {
      // transient errors get one retry; only a SIZE rejection may degrade
      up = await service.storage
        .from(REC_BUCKET)
        .upload(fullPath, fullBuf, { contentType: "audio/mpeg", upsert: true });
    }
    let fullStored = true;
    if (up.error) {
      if (!isSizeError(up.error.message)) {
        return fail(`full upload failed: ${up.error.message}`);
      }
      // Bigger than the storage cap: the per-part cuts below are the real
      // deliverables (this is exactly how the old pipeline died). Degrade.
      console.error(`recording ${rec.id}: full.mp3 over the storage cap (${up.error.message}); continuing without it`);
      fullStored = false;
    }

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

    // cut each segment by stream-copy + upload, COLLECTING rows + zip entries.
    // We delete+insert the segment rows only AFTER every cut/upload succeeds, so
    // a mid-run failure (return fail) leaves the prior segments intact instead of
    // wiping them up front (audit polish — a recut no longer has a zero-row window).
    // MEMORY CEILING (audit 2026-08-05). The zip is built in memory and holds a
    // second copy of everything, so a long show used to peak at roughly
    // 2x(full + segments) — a 2.5h broadcast is ~185MB of MP3, which OOMs the
    // function before it ever reaches the time limit. Past the budget we simply
    // skip the zip: every individual MP3 is still uploaded and downloadable, and
    // losing the convenience bundle beats losing the whole recording.
    const ZIP_BUDGET_BYTES = 120 * 1024 * 1024;
    let zipBytes = fullBuf.length;
    let zipTooBig = zipBytes > ZIP_BUDGET_BYTES;
    const zipEntries: { name: string; data: Buffer }[] = zipTooBig
      ? []
      : [{ name: "full.mp3", data: fullBuf }];
    const segRows: {
      recording_id: string;
      idx: number;
      label: string;
      start_offset: number;
      end_offset: number;
      storage_path: string;
      size_bytes: number;
      duration_seconds: number;
    }[] = [];
    for (const seg of segments) {
      // remap wall offsets into gap-aware audio offsets (identity for legacy)
      const aStart = presentBefore(seg.startOffset);
      const aEnd = presentBefore(seg.endOffset);
      if (aEnd - aStart < 3) continue; // the audio for this span is gone
      const local = join(work, `seg-${seg.idx}.mp3`);
      await run(FFMPEG, [
        "-y",
        "-ss", String(aStart),
        "-to", String(aEnd),
        "-i", fullLocal,
        "-c", "copy",
        local,
      ]);
      let buf = await readFile(local);
      const storagePath = `${roomId}/seg-${seg.idx}.mp3`;
      let segUp = await service.storage
        .from(REC_BUCKET)
        .upload(storagePath, buf, { contentType: "audio/mpeg", upsert: true });
      if (segUp.error && isSizeError(segUp.error.message)) {
        // one very long uninterrupted stretch (a discussion room with no clock
        // markers) can exceed the cap - re-encode that cut smaller and retry
        await run(FFMPEG, [
          "-y", "-ss", String(aStart), "-to", String(aEnd),
          "-i", fullLocal, "-ac", "1", "-c:a", "libmp3lame", "-q:a", "9", local,
        ]);
        buf = await readFile(local);
        segUp = await service.storage
          .from(REC_BUCKET)
          .upload(storagePath, buf, { contentType: "audio/mpeg", upsert: true });
      }
      if (segUp.error) {
        if (isSizeError(segUp.error.message) && fullStored) {
          // even q9 mono won't fit: skip this one cut rather than burying the
          // whole recording - the full file still carries the audio
          console.error(`recording ${rec.id}: cut #${seg.idx} over the storage cap even at q9; skipped`);
          await rm(local, { force: true }).catch(() => {});
          continue;
        }
        return fail(`segment upload failed: ${segUp.error.message}`);
      }
      await rm(local, { force: true }).catch(() => {}); // /tmp discipline
      segRows.push({
        recording_id: rec.id,
        idx: seg.idx,
        label: seg.label,
        start_offset: seg.startOffset,
        end_offset: seg.endOffset,
        storage_path: storagePath,
        size_bytes: buf.length,
        duration_seconds: seg.endOffset - seg.startOffset,
      });
      zipBytes += buf.length;
      if (!zipTooBig && zipBytes > ZIP_BUDGET_BYTES) {
        // crossed the budget mid-run: drop what we were accumulating so the
        // rest of the job doesn't carry it
        zipTooBig = true;
        zipEntries.length = 0;
      }
      if (!zipTooBig) {
        zipEntries.push({
          name: `${String(seg.idx).padStart(2, "0")} ${seg.label}.mp3`,
          data: buf,
        });
      }
    }
    // every segment cut + uploaded — now swap the rows (narrow delete→insert window)
    await service.from("recording_segments").delete().eq("recording_id", rec.id);
    if (segRows.length) {
      const segIns = await service.from("recording_segments").insert(segRows);
      if (segIns.error) return fail(`segment rows insert failed: ${segIns.error.message}`);
    }

    // zip everything for one-click download — non-fatal: a zip hiccup
    // must not deny the commentator the individual MP3s
    let zipPath: string | null = null;
    try {
      if (zipTooBig) {
        console.warn(
          `recording ${rec.id}: skipping zip, ${Math.round(zipBytes / 1e6)}MB exceeds the in-memory budget`,
        );
        throw new Error("zip skipped (too large)");
      }
      const zipBuf = buildZipStore(zipEntries);
      zipPath = `${roomId}/all.zip`;
      // The full and segment uploads above check .error and this one did not,
      // so a rejected upload still wrote zip_path and the host got a "Download
      // all" button that 404s. Seen for real on a 3h show whose 83MB zip did
      // not land while every individual MP3 did.
      const zipUp = await service.storage
        .from(REC_BUCKET)
        .upload(zipPath, zipBuf, { contentType: "application/zip", upsert: true });
      if (zipUp.error) throw new Error(`zip upload failed: ${zipUp.error.message}`);
    } catch (e) {
      console.error("zip failed (segments still available):", (e as Error).message);
      zipPath = null;
    }

    // Look at what we actually produced before calling it a success. Every
    // check above this point only proves a file exists and is non-trivial in
    // BYTES; none of them would notice 11 minutes of digital silence sitting
    // where a 2.5 hour show should be.
    if (!fullStored && segRows.length === 0) {
      return fail("nothing fits under the storage size cap - the audio is safe in the radio segments; raise the Supabase upload limit and retry");
    }
    const expectedSeconds = Math.max(0, (endMs - startMs) / 1000);
    const measured = parseMeasure(encodeStderr) ?? (await measureAudio(fullLocal));
    const problem = integrityProblem(measured, expectedSeconds);
    const status = problem ? "damaged" : "ready";
    if (problem) {
      console.error(`recording ${rec.id}: DAMAGED - ${problem}`);
    }

    const { error: finalErr } = await service
      .from("recordings")
      .update({
        status,
        full_mp3_path: fullStored ? fullPath : null,
        zip_path: zipPath,
        duration_seconds: expectedSeconds,
        audio_seconds: measured.seconds,
        audible_seconds: measured.audible,
        // the host reads this string; keep it plain and specific
        error: problem,
      })
      .eq("id", rec.id);
    if (finalErr) return fail(`final status write failed: ${finalErr.message}`);

    // The segments are deliberately NOT purged here: the marker-adjust recut
    // (FR-13.3) re-runs this whole pipeline and needs its source intact, and a
    // 3h full.mp3 cannot be re-derived from anything else under the storage
    // cap. The daily cron purges radio prefixes 48h after a room ends - the
    // recut window - which relaxes FR-14.2's live-only rule by two days
    // (decision-logged as Assumed, founder can override).

    return { status, segments: segments.length };
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
