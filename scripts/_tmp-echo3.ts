import { execFile } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { RoomServiceClient } from "livekit-server-sdk";
import ffmpegPath from "ffmpeg-static";
import "dotenv/config";
const run = promisify(execFile);
const FF = (ffmpegPath as unknown as string) || "ffmpeg";
const OUT = process.env.OUT!;
const ROOM = "cea622f8-d418-418f-ae9f-bf8d840e010c";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const svc = new RoomServiceClient(process.env.LIVEKIT_URL!.replace(/^wss:/, "https:"), process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
  const ps = await svc.listParticipants(`match_${ROOM}`);
  console.log("=== CONNECTED NOW ===");
  let listeners = 0;
  for (const p of ps) {
    const isEgress = p.identity.startsWith("EG_");
    if (!isEgress && p.tracks.length === 0) listeners++;
    const mut = p.tracks.map((t) => (t.muted ? "muted" : "LIVE")).join(",");
    console.log(`  ${p.identity.padEnd(50)} pubs=${p.tracks.length}${mut ? ` (${mut})` : ""}${isEgress ? " [recorder]" : ""}`);
  }
  console.log(`  -> ${listeners} WebRTC listener connection(s). Radio (HLS) listeners are invisible here.`);

  // stream measurement: short lags (device doubling) AND long lags (radio
  // playing out loud somewhere near the host mic re-entering the broadcast)
  const { data: objs } = await s.storage.from("radio").list(ROOM, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  const segs = (objs ?? []).filter((o) => o.name.endsWith(".ts"));
  const latest = segs.slice(-15); // ~60s
  const parts: Buffer[] = [];
  for (const seg of latest) {
    const { data } = await s.storage.from("radio").download(`${ROOM}/${seg.name}`);
    parts.push(Buffer.from(await data!.arrayBuffer()));
  }
  writeFileSync(`${OUT}/e3.ts`, Buffer.concat(parts));
  await run(FF, ["-y", "-i", `${OUT}/e3.ts`, "-ac", "1", "-ar", "8000", "-f", "f32le", `${OUT}/e3.pcm`], { timeout: 120_000 });
  const buf = readFileSync(`${OUT}/e3.pcm`);
  const n = Math.floor(buf.length / 4);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = buf.readFloatLE(i * 4);
  let e = 0; for (let i = 0; i < n; i++) e += x[i] * x[i];
  const rms = Math.sqrt(e / n);
  console.log(`\n=== PUBLISHED STREAM, last ${(n / 8000).toFixed(0)}s, rms=${rms.toFixed(4)}${rms < 0.004 ? " (mostly silent - talk while I sample)" : ""} ===`);
  const scan = (fromMs: number, toMs: number, stepMs: number) => {
    const rows: [number, number][] = [];
    for (let ms = fromMs; ms <= toMs; ms += stepMs) {
      const lag = Math.floor((ms / 1000) * 8000);
      let num = 0, cnt = 0;
      for (let i = 0; i + lag < n; i += 8) { num += x[i] * x[i + lag]; cnt++; }
      rows.push([ms, num / cnt / (rms * rms || 1)]);
    }
    return rows.sort((a, b) => b[1] - a[1]);
  };
  const short = scan(60, 1500, 20);
  const long = scan(2000, 25000, 250);
  console.log("short lags (60ms-1.5s):"); for (const [ms, r] of short.slice(0, 3)) console.log(`   ${String(ms).padStart(5)} ms  ${r.toFixed(3)}`);
  console.log("long lags (2s-25s, radio loop shows here):"); for (const [ms, r] of long.slice(0, 3)) console.log(`   ${String(ms).padStart(5)} ms  ${r.toFixed(3)}`);
  const worst = [...short, ...long].sort((a, b) => b[1] - a[1])[0];
  console.log(worst[1] > 0.3
    ? `\nVERDICT: echo IS in the published stream, delayed copy at ~${worst[0]}ms - something near your mic is playing the room out loud`
    : "\nVERDICT: the published stream is CLEAN. The doubling is on the listening side (two players running).");
}
main().catch((e) => { console.error(e); process.exit(1); });
