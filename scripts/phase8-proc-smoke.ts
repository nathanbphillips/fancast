/**
 * Phase 8 processing pipeline smoke test (no LiveKit native binding —
 * usable when @livekit/rtc-node is blocked). Feeds a synthetic MP4 with
 * real audio (commentator tone throughout + a louder guest tone only in
 * the second half) plus markers, runs the real processRecording via the
 * API, and verifies: full MP3 + six bounded segments, audio energy per
 * segment, guest audio isolated to the second half, and adjust → recut.
 * Live egress capture is proven separately (smoke:radio + smoke8 MP4).
 *   npm run smoke8:proc / npm run smoke8:proc -- clean
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const run = promisify(execFile);
const FFMPEG = (ffmpegPath as unknown as string) || "ffmpeg";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const EMAIL = "fancast.proc.kev@example.com";
const PASSWORD = "proc-Kev-1!";

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
function cookieFor(s: Session) {
  return `sb-${PROJECT_REF}-auth-token=base64-` + Buffer.from(JSON.stringify(s)).toString("base64url");
}
async function api(path: string, cookie: string, body?: unknown, method = "POST") {
  const res = await fetch(`${APP}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === EMAIL);
  if (u) {
    const { data: rooms } = await service.from("rooms").select("id").eq("commentator_id", u.id);
    for (const r of rooms ?? []) {
      const { data: objs } = await service.storage.from("recordings").list(r.id);
      if (objs?.length) await service.storage.from("recordings").remove(objs.map((o) => `${r.id}/${o.name}`));
    }
    await service.from("rooms").delete().eq("commentator_id", u.id);
    await service.auth.admin.deleteUser(u.id);
    console.log(`removed ${EMAIL}`);
  }
  console.log("clean done");
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function rmsOf(url: string, dir: string, tag: string) {
  const mp3 = join(dir, `${tag}.mp3`);
  const raw = join(dir, `${tag}.raw`);
  await writeFile(mp3, Buffer.from(await (await fetch(url)).arrayBuffer()));
  await run(FFMPEG, ["-y", "-i", mp3, "-f", "s16le", "-ac", "1", "-ar", "8000", raw]);
  const buf = await readFile(raw);
  let sum = 0;
  for (let i = 0; i + 1 < buf.length; i += 2) sum += buf.readInt16LE(i) ** 2;
  return Math.sqrt(sum / Math.max(1, buf.length / 2));
}

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();
  const dir = await mkdtemp(join(tmpdir(), "fc-proc-"));

  try {
    // commentator + a room placed directly in a wrapped-equivalent state
    const { data: created } = await service.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
    const userId = created.user!.id;
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const signIn = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    const session = signIn.data.session;
    if (!session) throw new Error("sign-in failed");
    const cookie = cookieFor(session);
    await api("/api/profile", cookie, { username: "proc_kev" });
    await service.from("profiles").update({ role: "commentator" }).eq("user_id", userId);

    const startMs = Date.now() - 60_000;
    const { data: room } = await service
      .from("rooms")
      .insert({ fixture_id: -1, commentator_id: userId, state: "wrapped", scheduled_kickoff: new Date(startMs).toISOString(), started_at: new Date(startMs).toISOString(), ended_at: new Date(startMs + 43_000).toISOString() })
      .select()
      .single();
    const roomId = room!.id as string;

    // synthetic MP4: 440Hz throughout (commentator), 880Hz only 19-33s
    // (a guest in the second half, louder)
    const mp4 = join(dir, "broadcast.mp4");
    await run(FFMPEG, [
      "-y",
      "-filter_complex",
      "sine=frequency=440:duration=43:sample_rate=48000,volume=0.3[c];" +
        "sine=frequency=880:duration=14:sample_rate=48000,volume=0.6,adelay=19000[g];" +
        "[c][g]amix=inputs=2:duration=longest:normalize=0[a]",
      "-map", "[a]", "-c:a", "aac", "-ar", "48000", mp4,
    ]);
    const sourcePath = `${roomId}/broadcast.mp4`;
    const upMp4 = await service.storage.from("recordings").upload(sourcePath, await readFile(mp4), { contentType: "video/mp4", upsert: true });
    check("synthetic source uploaded", !upMp4.error, upMp4.error?.message ?? "");

    // markers (offsets from start)
    const offsets: [string, number][] = [
      ["broadcast_start", 0], ["start_1h", 8], ["stop_1h", 14], ["start_2h", 19],
      ["stop_2h", 33], ["start_et", 33.3], ["stop_et", 39], ["broadcast_end", 43],
    ];
    const labels: Record<string, string> = {
      broadcast_start: "Pre-game show", start_1h: "First half", stop_1h: "Halftime show",
      start_2h: "Second half", stop_2h: "Post-game show", start_et: "Extra time",
      stop_et: "Post-game show", broadcast_end: "Pre-game show",
    };
    await service.from("broadcast_markers").insert(
      offsets.map(([kind, off]) => ({ room_id: roomId, kind, label: labels[kind], source: "auto", server_ts: new Date(startMs + off * 1000).toISOString() })),
    );
    // status 'recording' (not 'processing') — processRecording atomically claims it
    await service.from("recordings").insert({ room_id: roomId, source_path: sourcePath, started_at: new Date(startMs).toISOString(), ended_at: new Date(startMs + 43_000).toISOString(), status: "recording" });

    // trigger the async pipeline, then poll to ready (the real panel flow)
    const pollReady = async () => {
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        const g = (await api(`/api/recordings?room=${roomId}`, cookie, undefined, "GET")).body;
        if (g.recording?.status === "ready" || g.recording?.status === "failed") return g;
        await sleep(3000);
      }
      return (await api(`/api/recordings?room=${roomId}`, cookie, undefined, "GET")).body;
    };
    await api("/api/recordings", cookie, { action: "process", roomId });
    const panel = await pollReady();
    check("processing reaches ready", panel.recording?.status === "ready", panel.recording?.status ?? "timeout");
    const files = panel.files ?? [];
    const segLabels = files.slice(1).map((f: { label: string }) => f.label);
    check(
      "six correctly-labeled segments",
      JSON.stringify(segLabels) === JSON.stringify(["Pre-game show", "First half", "Halftime show", "Second half", "Extra time", "Post-game show"]),
      segLabels.join(" | "),
    );
    check("full broadcast file present with URL", files[0]?.label === "Full broadcast" && Boolean(files[0]?.url));
    check("zip present", Boolean(panel.zipUrl));
    check("every file has a signed URL", files.length > 0 && files.every((f: { url: string }) => Boolean(f.url)));

    // segment durations roughly match the marker spans
    const dur = (label: string) => files.find((f: { label: string; durationSeconds: number }) => f.label === label)?.durationSeconds ?? 0;
    check("first half ~6s", Math.abs(dur("First half") - 6) < 1.5, `${dur("First half").toFixed(1)}s`);
    check("second half ~14s", Math.abs(dur("Second half") - 14) < 1.5, `${dur("Second half").toFixed(1)}s`);

    // audio energy: both halves audible, second half louder (guest mixed in)
    const firstRms = await rmsOf(files.find((f: { label: string }) => f.label === "First half").url, dir, "first");
    const secondRms = await rmsOf(files.find((f: { label: string }) => f.label === "Second half").url, dir, "second");
    check("first half has commentator audio", firstRms > 50, `rms ${Math.round(firstRms)}`);
    check("second half louder (guest audio mixed into the recording)", secondRms > firstRms * 1.3, `first ${Math.round(firstRms)} vs second ${Math.round(secondRms)}`);

    // adjust → recut (async; poll to ready)
    const htMarker = (panel.markers ?? []).find((m: { label: string }) => m.label === "Halftime show");
    const before = dur("First half");
    await api("/api/recordings", cookie, { action: "adjust", roomId, markerId: htMarker.id, deltaSeconds: -3 });
    await api("/api/recordings", cookie, { action: "process", roomId });
    await sleep(2000);
    const after = await pollReady();
    check("recut reaches ready", after.recording?.status === "ready", after.recording?.status ?? "timeout");
    const firstAfter = (after.files ?? []).find((f: { label: string; durationSeconds: number }) => f.label === "First half")?.durationSeconds ?? 0;
    check("adjust shortened the first half by ~3s", Math.abs((before - firstAfter) - 3) < 1.5, `before ${before.toFixed(1)} after ${firstAfter.toFixed(1)}`);

    // a marker adjustment cannot cross a neighbour (which would scramble
    // labels, e.g. Post-game before Second half). An extreme -120s shove on
    // Halftime clamps to just after kickoff — First half may collapse to a
    // dropped sliver, but the surviving labels must stay in lifecycle order.
    await api("/api/recordings", cookie, { action: "adjust", roomId, markerId: htMarker.id, deltaSeconds: -120 });
    await api("/api/recordings", cookie, { action: "process", roomId });
    await sleep(2000);
    const crossed = await pollReady();
    const crossedLabels = (crossed.files ?? []).slice(1).map((f: { label: string }) => f.label);
    const canonical = ["Pre-game show", "First half", "Halftime show", "Second half", "Extra time", "Post-game show"];
    const isSubsequence = (() => {
      let i = 0;
      for (const l of crossedLabels) {
        i = canonical.indexOf(l, i);
        if (i === -1) return false;
        i++;
      }
      return true;
    })();
    check(
      "labels stay in lifecycle order after an extreme adjust (no scramble)",
      isSubsequence,
      crossedLabels.join(" | "),
    );
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
