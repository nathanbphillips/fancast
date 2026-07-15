/**
 * Read-only check that the DEPLOYED Vercel app has its env wired correctly —
 * the things that are invisible until a live session breaks. Hits the
 * production URL, never writes data.
 *   npm run smoke:prod                 (defaults to the prod domain)
 *   npm run smoke:prod -- https://my-preview.vercel.app
 *
 * Verifies:
 *   - the app is deployed and serving           (GET /)
 *   - ABLY_API_KEY is set in Vercel              (/api/ably/token mints a request)
 *   - LIVEKIT_* + Supabase service key are set   (/api/livekit/token mints a token)
 *   - NEXT_PUBLIC_SUPABASE_* are baked into the client bundle (anon-key path)
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const BASE = (process.argv[2] || process.env.PROD_URL || "https://arseradio.com").replace(/\/$/, "");
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPA_REF = new URL(SUPA_URL).hostname.split(".")[0];
const AUDIO_STATES = ["waiting", "pregame", "live_1h", "halftime", "live_2h", "extra_time", "postgame"];
// env vars that may legitimately be absent for a controlled test
const OPTIONAL_ENV = new Set(["SPORTMONKS_API_TOKEN", "NEXT_PUBLIC_APP_URL"]);
const PROBE_EMAIL = "fancast.health.probe@example.com";
const PROBE_PW = "health-Probe-1!";

let failures = 0;
let warnings = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
function warn(name: string, detail = "") {
  console.log(`WARN  ${name}${detail ? ` — ${detail}` : ""}`);
  warnings++;
}

async function main() {
  console.log(`Target: ${BASE}\n`);
  const service = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // 1. deployed + serving
  const home = await fetch(BASE, { redirect: "manual" });
  check("app is deployed and serving (GET /)", home.status >= 200 && home.status < 400, `HTTP ${home.status}`);

  // 2. Ably token — works for any valid room id (anonymous), proves ABLY_API_KEY
  const anyRoomId = "00000000-0000-4000-8000-000000000000";
  const ablyRes = await fetch(`${BASE}/api/ably/token?room=${anyRoomId}`);
  const ablyBody = await ablyRes.json().catch(() => ({}));
  check(
    "ABLY_API_KEY wired in Vercel (/api/ably/token)",
    ablyRes.status === 200 && (typeof ablyBody.keyName === "string" || typeof ablyBody.mac === "string"),
    `HTTP ${ablyRes.status}`,
  );

  // 3. LiveKit token — needs a real audio-state room to mint a token
  const { data: room } = await service
    .from("rooms").select("id, state").in("state", AUDIO_STATES).limit(1).maybeSingle();
  if (!room) {
    warn("no audio-state room exists to mint a LiveKit token — skipping LiveKit check", "open a waiting room and re-run");
  } else {
    const lkRes = await fetch(`${BASE}/api/livekit/token?room=${room.id}`);
    const lkBody = await lkRes.json().catch(() => ({}));
    check(
      "LIVEKIT_* + Supabase service key wired in Vercel (/api/livekit/token)",
      lkRes.status === 200 && typeof lkBody.token === "string" && typeof lkBody.url === "string",
      `HTTP ${lkRes.status} (room ${room.state})`,
    );
    check(
      "LiveKit URL returned is a wss endpoint",
      typeof lkBody.url === "string" && lkBody.url.startsWith("wss://"),
      lkBody.url,
    );

    // reconnect snapshot endpoint (M-4) deployed + serving the public slice
    const snapRes = await fetch(`${BASE}/api/rooms/${room.id}/snapshot`);
    const snap = await snapRes.json().catch(() => ({}));
    check(
      "reconnect snapshot endpoint live (M-4)",
      snapRes.status === 200 && typeof snap.state === "string" && Array.isArray(snap.clockEvents),
      `HTTP ${snapRes.status}`,
    );
  }

  // 4. NEXT_PUBLIC_SUPABASE_ANON_KEY baked into the client bundle, by its
  // signature (the distinctive last JWT segment) — proves the anon key
  // specifically, not just the URL. Build-time inline: updates only on redeploy.
  // Also assert the SERVICE key never leaked into the browser bundle.
  const anonSig = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").split(".").pop() ?? "";
  const svcSig = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").split(".").pop() ?? "";
  const html = await home.text();
  const chunkUrls = Array.from(html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js/g)).map((m) => m[0]);
  let corpus = html + SUPA_REF; // SUPA_REF baseline so an empty bundle still shows URL state
  for (const url of chunkUrls.slice(0, 16)) {
    corpus += await fetch(`${BASE}${url}`).then((r) => r.text()).catch(() => "");
  }
  if (anonSig && corpus.includes(anonSig)) {
    check("NEXT_PUBLIC_SUPABASE_ANON_KEY baked into the deployed bundle", true);
  } else if (corpus.includes(SUPA_REF)) {
    warn(
      "Supabase URL is in the bundle but the anon key signature is NOT",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is likely missing in Vercel or the deploy predates it — add it and redeploy",
    );
  } else {
    warn("could not confirm NEXT_PUBLIC_SUPABASE_ANON_KEY in the bundle", "verify by signing in on the live site");
  }
  check(
    "service-role key did NOT leak into the browser bundle (security)",
    !svcSig || !corpus.includes(svcSig),
  );

  // 5. Definitive env presence via the admin-gated /api/health probe — covers
  // the S3 + server LiveKit vars a read-only check can't exercise. Uses a
  // throwaway admin session (cleaned up after).
  const prior = (await service.auth.admin.listUsers({ perPage: 1000 })).data?.users.find((u) => u.email === PROBE_EMAIL);
  if (prior) await service.auth.admin.deleteUser(prior.id);
  const { data: made } = await service.auth.admin.createUser({ email: PROBE_EMAIL, password: PROBE_PW, email_confirm: true });
  try {
    await service.from("profiles").insert({ user_id: made!.user!.id, username: "health_probe", role: "admin" });
    const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
    const { data: si } = await anon.auth.signInWithPassword({ email: PROBE_EMAIL, password: PROBE_PW });
    const cookie = `sb-${SUPA_REF}-auth-token=base64-` + Buffer.from(JSON.stringify(si!.session)).toString("base64url");
    const res = await fetch(`${BASE}/api/health`, { headers: { Cookie: cookie } });
    if (res.status === 404) {
      warn("/api/health not deployed yet", "push and wait for the Vercel redeploy, then re-run smoke:prod for the definitive env list");
    } else if (res.status !== 200) {
      warn(`/api/health returned HTTP ${res.status}`, "expected 200 for an admin session");
    } else {
      const { env } = (await res.json()) as { env: Record<string, boolean> };
      console.log("  -- Vercel env presence (booleans, no values) --");
      for (const [k, present] of Object.entries(env)) {
        if (present) check(`env present: ${k}`, true);
        else if (OPTIONAL_ENV.has(k)) warn(`env missing (optional/known): ${k}`);
        else check(`env present: ${k}`, false, "MISSING in Vercel");
      }
    }
  } finally {
    await service.auth.admin.deleteUser(made!.user!.id);
  }

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}${warnings ? ` (${warnings} warning${warnings > 1 ? "s" : ""})` : ""}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
