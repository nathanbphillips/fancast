/**
 * Import legacy episodes from the show's old Spotify-hosted RSS feed into the
 * Arseradio podcast feed (founder 2026-09-07), keeping each episode's ORIGINAL
 * guid, title, description, and publish date so Spotify matches them as the
 * same episodes across the host migration.
 *
 * Audio: episodes under the 50MB storage cap are copied byte-for-byte from
 * the old host. The two full-match uploads exceed the cap, so their audio is
 * re-sourced from our own recording cuts of the same broadcasts (Chelsea's
 * "Full match" blend; Villa's blend concatenated from its three stored parts).
 *
 *   node --env-file=.env.local --import tsx scripts/podcast-import.mts <rss-url>
 *
 * Idempotent: an episode whose guid already exists is updated, not duplicated.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { createClient } from "@supabase/supabase-js";
import { PODCAST_BUCKET } from "../lib/podcast.js";

const run = promisify(execFile);
const FFMPEG = ffmpegPath as unknown as string;
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RSS_URL = process.argv[2] ?? "https://anchor.fm/s/11650b1a0/podcast/rss";
const STORAGE_CAP = 49 * 1024 * 1024;

/** oversized legacy uploads whose audio comes from our own cuts instead:
 *  guid -> how to build the replacement file */
const OVERSIZE_SOURCES: Record<
  string,
  { roomId: string; labels: string[]; note: string }
> = {
  // Arsenal vs Chelsea Full Match Commentary (106MB upload)
  "356572e8-61bb-40fa-8db1-91b46a321408": {
    roomId: "023ec7f2-956d-4763-aa5b-5bad9bb918e6",
    labels: ["Full match"],
    note: "Chelsea full-match blend from our own cuts",
  },
  // Arsenal vs Aston Villa Full Match Commentary (112MB upload)
  "5a3c0f13-44e6-40de-8e2d-124a0319ad67": {
    roomId: "94d054cb-f1f9-4e26-9de2-84ba947ed33e",
    labels: ["First half", "Halftime show", "Second half"],
    note: "Villa blend concatenated from its three stored parts",
  },
};

function field(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  let v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) v = cdata[1].trim();
  return v;
}

function decodeEntities(v: string): string {
  return v
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ");
}

/** HTML description -> plain text (our feed emits plain text uniformly) */
function stripHtml(v: string): string {
  return decodeEntities(
    v
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  ).trim();
}

function durationToSeconds(v: string | null): number {
  if (!v) return 0;
  if (/^\d+$/.test(v)) return Number(v);
  const parts = v.split(":").map(Number);
  return parts.reduce((a, p) => a * 60 + p, 0);
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`download ${res.status} for ${url.slice(0, 90)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function buildReplacement(spec: { roomId: string; labels: string[] }, work: string): Promise<Buffer> {
  const { data: rec } = await s.from("recordings").select("id").eq("room_id", spec.roomId).single();
  const { data: rows } = await s
    .from("recording_segments")
    .select("idx, label, storage_path")
    .eq("recording_id", rec!.id)
    .order("idx");
  const parts: string[] = [];
  for (const label of spec.labels) {
    const row = (rows ?? []).filter((r) => r.label === label).sort((a, b) => a.idx - b.idx)[0];
    if (!row) throw new Error(`missing cut "${label}" for room ${spec.roomId}`);
    const { data: blob, error } = await s.storage.from("recordings").download(row.storage_path);
    if (error || !blob) throw new Error(`download ${row.storage_path}: ${error?.message}`);
    const local = join(work, `part-${parts.length}.mp3`);
    await writeFile(local, Buffer.from(await blob.arrayBuffer()));
    parts.push(local);
  }
  if (parts.length === 1) return readFile(parts[0]);
  // same-encoder stream-copied parts concatenate cleanly; -c copy re-muxes
  // one continuous file with a correct duration header
  const listFile = join(work, "list.txt");
  await writeFile(listFile, parts.map((p) => `file '${p.replaceAll("\\", "/")}'`).join("\n"));
  const out = join(work, "blend.mp3");
  await run(FFMPEG, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", out], { timeout: 300_000 });
  return readFile(out);
}

async function main() {
  console.log("fetching", RSS_URL);
  const xml = (await download(RSS_URL)).toString("utf8");
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  console.log(`${items.length} episode(s) in the old feed`);
  const work = await mkdtemp(join(tmpdir(), "pod-import-"));
  let imported = 0;
  for (const block of items) {
    const guid = field(block, "guid");
    const title = decodeEntities(field(block, "title") ?? "");
    const description = stripHtml(field(block, "description") ?? "");
    const pubDate = field(block, "pubDate");
    const durS = durationToSeconds(field(block, "itunes:duration"));
    const encl = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*/i)?.[1];
    if (!guid || !title || !pubDate || !encl) {
      console.log("SKIP (missing fields):", title || "(untitled)");
      continue;
    }
    console.log(`\n"${title}"`);
    const spec = OVERSIZE_SOURCES[guid];
    let bytes: Buffer;
    let realDurS = durS;
    if (spec) {
      console.log(`  oversized upload; ${spec.note}`);
      bytes = await buildReplacement(spec, work);
      // the replacement's real length can differ slightly from the upload's
      const local = join(work, "probe.mp3");
      await writeFile(local, bytes);
      const { stderr } = await run(FFMPEG, ["-i", local, "-f", "null", "-"], { timeout: 300_000, maxBuffer: 1 << 24 }).catch((e) => e as { stderr: string });
      const t = String(stderr).match(/time=(\d+):(\d+):([\d.]+)/g)?.pop()?.match(/time=(\d+):(\d+):([\d.]+)/);
      if (t) realDurS = Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
    } else {
      bytes = await download(decodeEntities(encl));
      if (bytes.length > STORAGE_CAP) {
        console.log(`  SKIP: ${Math.round(bytes.length / 1e6)}MB exceeds the storage cap and no replacement is mapped`);
        continue;
      }
    }
    const audioPath = `episodes/import-${guid}.mp3`;
    const { error: upErr } = await s.storage.from(PODCAST_BUCKET).upload(audioPath, bytes, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw new Error(`upload: ${upErr.message}`);
    const row = {
      room_id: null,
      kind: "import",
      title,
      description,
      audio_path: audioPath,
      audio_bytes: bytes.length,
      duration_seconds: realDurS,
      guid,
      published_at: new Date(pubDate).toISOString(),
      created_by: null,
    };
    const { data: existing, error: exErr } = await s.from("podcast_episodes").select("id").eq("guid", guid).maybeSingle();
    if (exErr) throw new Error(`existence check: ${exErr.message}`); // never risk a duplicate insert
    const write = existing
      ? await s.from("podcast_episodes").update(row).eq("id", existing.id)
      : await s.from("podcast_episodes").insert(row);
    if (write.error) throw new Error(`row: ${write.error.message}`);
    console.log(`  imported: ${Math.round(bytes.length / 1e6)}MB, ${Math.round(realDurS / 60)}m, guid kept`);
    imported++;
  }
  console.log(`\n${imported}/${items.length} imported`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
