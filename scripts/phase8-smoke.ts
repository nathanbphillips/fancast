/**
 * Phase 8 recording/downloads smoke test against a RUNNING dev server.
 * Simulated session with two on-air guests + a full clock cycle (incl.
 * extra time) → full broadcast MP3 + six correctly-bounded segments, an
 * audio-energy check proving guest audio landed in the second half, and a
 * marker adjust → recut. Mirrors the FR-13 acceptance test.
 *   npm run smoke8 / npm run smoke8 -- clean
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  Room as RtcRoom,
  TrackPublishOptions,
  TrackSource,
} from "@livekit/rtc-node";
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
const FIXTURE_ID = -1;
const PASSWORD = "rec-Pass-1!";

const USERS = [
  { email: "fancast.rec.kev@example.com", username: "rec_kev", role: "commentator" },
  { email: "fancast.rec.alice@example.com", username: "rec_alice" },
  { email: "fancast.rec.bob@example.com", username: "rec_bob" },
];

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

function cookieFor(s: Session): string {
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function s3(): S3Client {
  return new S3Client({
    endpoint: process.env.SUPABASE_S3_ENDPOINT!,
    region: process.env.SUPABASE_S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY!,
      secretAccessKey: process.env.SUPABASE_S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
}
async function cleanBucket(bucket: string, prefix: string) {
  const c = s3();
  const listed = await c
    .send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))
    .catch(() => null);
  for (const o of listed?.Contents ?? []) {
    await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.Key! }));
  }
}
async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const t of USERS) {
    const u = data?.users.find((x) => x.email === t.email);
    if (u) {
      const { data: rooms } = await service.from("rooms").select("id").eq("commentator_id", u.id);
      for (const r of rooms ?? []) {
        await cleanBucket("radio", r.id);
        await cleanBucket("recordings", r.id);
      }
      await service.from("rooms").delete().eq("commentator_id", u.id);
      await service.auth.admin.deleteUser(u.id);
      console.log(`removed ${t.email}`);
    }
  }
  console.log("clean done");
}

/** Publish a tone for `seconds` at `amp` (0..1). Resolves when done. */
async function publishTone(room: RtcRoom, freq: number, seconds: number, amp: number) {
  const sr = 48000;
  const source = new AudioSource(sr, 1);
  const track = LocalAudioTrack.createAudioTrack("a", source);
  await room.localParticipant!.publishTrack(
    track,
    new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE, dtx: false }),
  );
  const spf = 480;
  const frames = Math.floor((seconds * sr) / spf);
  let phase = 0;
  for (let i = 0; i < frames; i++) {
    const data = new Int16Array(spf);
    for (let s = 0; s < spf; s++) {
      data[s] = Math.round(Math.sin(phase) * 32000 * amp);
      phase += (2 * Math.PI * freq) / sr;
    }
    await source.captureFrame(new AudioFrame(data, sr, 1, spf));
  }
}

/** RMS of an MP3 from a signed URL, via ffmpeg decode to raw PCM. */
async function rmsOf(url: string, dir: string, tag: string): Promise<number> {
  const mp3 = join(dir, `${tag}.mp3`);
  const raw = join(dir, `${tag}.raw`);
  await writeFile(mp3, Buffer.from(await (await fetch(url)).arrayBuffer()));
  await run(FFMPEG, ["-y", "-i", mp3, "-f", "s16le", "-ac", "1", "-ar", "8000", raw]);
  const buf = await readFile(raw);
  const samples = buf.length / 2;
  if (samples === 0) return 0;
  let sum = 0;
  for (let i = 0; i + 1 < buf.length; i += 2) {
    const v = buf.readInt16LE(i);
    sum += v * v;
  }
  return Math.sqrt(sum / samples);
}

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  const cookies: Record<string, string> = {};
  const ids: Record<string, string> = {};
  for (const t of USERS) {
    const { data: created, error } = await service.auth.admin.createUser({
      email: t.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    ids[t.username] = created.user.id;
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: si } = await anon.auth.signInWithPassword({ email: t.email, password: PASSWORD });
    cookies[t.username] = cookieFor(si!.session!);
    await api("/api/profile", cookies[t.username], { username: t.username });
    await service
      .from("profiles")
      .update({ created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(), ...(t.role ? { role: t.role } : {}) })
      .eq("user_id", created.user.id);
  }

  // open + start (egress + recording begin)
  let r = await api("/api/rooms", cookies.rec_kev, { action: "open_waiting", fixtureId: FIXTURE_ID });
  const roomId = r.body.room.id as string;
  await api("/api/rooms", cookies.rec_kev, { action: "start", roomId });

  const { data: recStart } = await service.from("recordings").select("status, egress_id").eq("room_id", roomId).maybeSingle();
  check("recording row created on start", recStart?.status === "recording" && Boolean(recStart?.egress_id));

  // commentator joins LiveKit and publishes 440Hz for the whole session
  const kevTok = (await api(`/api/livekit/token?room=${roomId}`, cookies.rec_kev, undefined, "GET")).body;
  const kevRoom = new RtcRoom();
  await kevRoom.connect(kevTok.url, kevTok.token, { autoSubscribe: false, dynacast: false });
  const kevPublishing = publishTone(kevRoom, 440, 40, 0.25);

  // seed messages so guests clear the 5-message call-in gate
  for (const u of ["rec_alice", "rec_bob"]) {
    await service.from("chat_messages").insert(
      Array.from({ length: 5 }, (_, i) => ({ room_id: roomId, user_id: ids[u], body: `seed ${i}` })),
    );
  }

  // drive the clock through a full cycle with real-duration segments
  await sleep(4000); // pre-game
  await api("/api/clock", cookies.rec_kev, { roomId, action: "start1h" });
  await sleep(5000); // first half (commentator only)
  await api("/api/clock", cookies.rec_kev, { roomId, action: "stop1h" });
  await sleep(4000); // halftime
  await api("/api/clock", cookies.rec_kev, { roomId, action: "start2h" });

  // two guests go on air during the second half and publish loudly
  const guestRooms: RtcRoom[] = [];
  for (const [u, freq] of [["rec_alice", 880], ["rec_bob", 1320]] as const) {
    const req = await api("/api/talk", cookies[u], { roomId, topic: "on air", consent: true });
    await api("/api/talk", cookies.rec_kev, { requestId: req.body.request.id, status: "accepted" }, "PATCH");
    const tok = (await api(`/api/livekit/token?room=${roomId}`, cookies[u], undefined, "GET")).body;
    check(`${u} granted publish after accept`, tok.canPublish === true);
    const gr = new RtcRoom();
    await gr.connect(tok.url, tok.token, { autoSubscribe: false, dynacast: false });
    guestRooms.push(gr);
    void publishTone(gr, freq, 6, 0.5);
  }
  await sleep(7000); // second half (commentator + two guests)
  await api("/api/clock", cookies.rec_kev, { roomId, action: "stop2h" });

  await api("/api/clock", cookies.rec_kev, { roomId, action: "start_et" }); // prompt -> no sliver
  await sleep(5000); // extra time
  await api("/api/clock", cookies.rec_kev, { roomId, action: "stop_et" });
  await sleep(3000); // post-game

  await kevPublishing.catch(() => {});
  for (const g of guestRooms) await g.disconnect();
  await kevRoom.disconnect();

  // end broadcast -> egress stops, after() processing runs
  r = await api("/api/rooms", cookies.rec_kev, { action: "end", roomId });
  check("broadcast ended", r.status === 200);

  // poll the panel API until ready (the real production path)
  let panel: { recording?: { status?: string }; files?: { label: string; durationSeconds: number; url: string }[]; zipUrl?: string; markers?: { id: string; label: string }[] } = {};
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const g = await api(`/api/recordings?room=${roomId}`, cookies.rec_kev, undefined, "GET");
    panel = g.body;
    if (panel.recording?.status === "ready" || panel.recording?.status === "failed") break;
    await sleep(5000);
  }
  check("recording processed to ready", panel.recording?.status === "ready", panel.recording?.status ?? "timeout");

  const files = panel.files ?? [];
  const segLabels = files.slice(1).map((f) => f.label);
  const expected = ["Pre-game show", "First half", "Halftime show", "Second half", "Extra time", "Post-game show"];
  check(
    "six correctly-labeled segments",
    JSON.stringify(segLabels) === JSON.stringify(expected),
    segLabels.join(" | "),
  );
  check("full broadcast file present", files[0]?.label === "Full broadcast" && Boolean(files[0]?.url));
  check("zip present", Boolean(panel.zipUrl));
  check(
    "all files have download URLs",
    files.every((f) => Boolean(f.url)),
  );

  // audio-energy proof: guest audio landed in the Second half, not the First
  const dir = await mkdtemp(join(tmpdir(), "fc-rec-test-"));
  try {
    const first = files.find((f) => f.label === "First half");
    const second = files.find((f) => f.label === "Second half");
    const firstRms = first ? await rmsOf(first.url, dir, "first") : 0;
    const secondRms = second ? await rmsOf(second.url, dir, "second") : 0;
    check("first half has commentator audio", firstRms > 50, `rms ${Math.round(firstRms)}`);
    check(
      "second half louder than first (guest audio mixed in)",
      secondRms > firstRms * 1.3,
      `first ${Math.round(firstRms)} vs second ${Math.round(secondRms)}`,
    );

    // adjust → recut: nudge the Halftime boundary and confirm it recuts
    const htMarker = (panel.markers ?? []).find((m) => m.label === "Halftime show");
    if (htMarker) {
      // move Halftime start 3s earlier → First half shortens by ~3s,
      // Halftime show lengthens by ~3s
      const before = files.find((f) => f.label === "First half")?.durationSeconds ?? 0;
      await api("/api/recordings", cookies.rec_kev, { action: "adjust", roomId, markerId: htMarker.id, deltaSeconds: -3 });
      const recut = await api("/api/recordings", cookies.rec_kev, { action: "process", roomId });
      check("recut succeeds", recut.body.status === "ready");
      const after = await api(`/api/recordings?room=${roomId}`, cookies.rec_kev, undefined, "GET");
      const firstAfter = (after.body.files ?? []).find((f: { label: string; durationSeconds: number }) => f.label === "First half")?.durationSeconds ?? 0;
      check(
        "adjust shortened the first half by ~3s",
        Math.abs((before - firstAfter) - 3) < 2,
        `before ${before?.toFixed?.(1)} after ${firstAfter?.toFixed?.(1)}`,
      );
    } else {
      check("halftime marker present for adjust", false);
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
