/**
 * MATCH-DAY PREFLIGHT. One command, run ~30 minutes before going on air, that
 * fails loudly if anything which has ever cost us a show is not in a working
 * state.
 *
 *   npm run preflight
 *   npm run preflight -- --room arsenal-vs-burnley-15-aug-2026-nathan
 *   npm run preflight -- --url https://my-preview.vercel.app
 *   npm run preflight -- --quick          (skip the slow in-bundle probes)
 *
 * Deliberately distinct from `npm run smoke:prod`, which asks "is the platform
 * configured". This asks "is TONIGHT going to work", and covers the three
 * classes smoke:prod cannot:
 *
 *   1. CODE vs SCHEMA vs DEPLOY parity. A migration sitting unapplied while the
 *      code that writes its column is live is the quietest way to break prod.
 *   2. NATIVE BINARIES INSIDE THE DEPLOYED FUNCTION. ffmpeg and sharp are
 *      force-included per-route in next.config.ts, are always present locally,
 *      and have both already failed only in production. The probes therefore
 *      run in situ, inside the very function bundles that use them.
 *   3. TONIGHT'S MATCH DATA. Not "is the token set" but "does THIS fixture
 *      resolve to real upstream data", which is what the Betis friendly missed
 *      (the league was outside the Sportmonks plan and nothing said so).
 *
 * Read-only against production, with two sanctioned throwaway writes: a
 * scratch egress started and immediately stopped (the only truthful test of
 * the LiveKit egress quota, ~one audio-minute of billing; skipped by --quick),
 * and a throwaway admin user, used
 * to reach the admin-gated probes and deleted in a finally block.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import "dotenv/config";

// ---------------------------------------------------------------- args + env

const argv = process.argv.slice(2);
function flag(name: string): string | null {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
}
const QUICK = argv.includes("--quick");
const BASE = (flag("url") ?? process.env.PROD_URL ?? "https://arseradio.com").replace(/\/$/, "");
const ROOM_ARG = flag("room");

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !ANON || !SERVICE_KEY) {
  console.error("Missing Supabase env locally. Preflight reads .env.local; see .env.example.");
  process.exit(1);
}
const SUPA_REF = new URL(SUPA_URL).hostname.split(".")[0];

const PROBE_EMAIL = "arseradio.preflight.probe@example.com";
const PROBE_USERNAME = "preflight_probe";
// Random per run, never written down. The probe user is a real ADMIN account on
// the production database for the few seconds it exists, so if a crash or a
// Ctrl-C ever outruns the cleanup below, what is left behind has no usable
// credential. (prod-smoke's equivalent account uses a fixed password.)
const PROBE_PW = `Pf-${randomBytes(24).toString("base64url")}-1!`;

// ------------------------------------------------------------------ reporting

type Level = "PASS" | "FAIL" | "WARN" | "INFO" | "SKIP";
const rows: { level: Level; name: string; detail: string }[] = [];
let section = "";

const C = {
  PASS: "\x1b[32m",
  FAIL: "\x1b[31m",
  WARN: "\x1b[33m",
  INFO: "\x1b[36m",
  SKIP: "\x1b[35m",
  dim: "\x1b[2m",
  off: "\x1b[0m",
};

function head(title: string) {
  section = title;
  console.log(`\n${C.dim}${"-".repeat(66)}${C.off}\n${title}`);
}
function emit(level: Level, name: string, detail = "") {
  rows.push({ level, name: section ? `${section}: ${name}` : name, detail });
  console.log(
    `  ${C[level]}${level.padEnd(4)}${C.off} ${name}${detail ? `${C.dim}  ${detail}${C.off}` : ""}`,
  );
}
const check = (name: string, ok: boolean, detail = "", softFail = false) =>
  emit(ok ? "PASS" : softFail ? "WARN" : "FAIL", name, detail);
const warn = (name: string, detail = "") => emit("WARN", name, detail);
const info = (name: string, detail = "") => emit("INFO", name, detail);
const fail = (name: string, detail = "") => emit("FAIL", name, detail);
/**
 * A check that could NOT run. Tracked separately and always reprinted in the
 * summary, because the failure mode this tool exists to prevent is a green
 * light over an unexamined system: a silently skipped probe reads exactly like
 * a passing one.
 */
const skip = (name: string, detail = "") => emit("SKIP", name, detail);

// ------------------------------------------------------------------- helpers

function git(args: string[]): string | null {
  try {
    // timeout matters: `git fetch` on a dead network can hang for minutes, and
    // this runs while the temporary admin account is still alive
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    }).trim();
  } catch {
    return null;
  }
}

async function getJson(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => null);
    return { status: res.status, body: body as Record<string, unknown> | null };
  } catch (err) {
    return { status: 0, body: null, error: (err as Error).message };
  }
}

/**
 * A short-lived admin session, so the script can reach the admin-gated probes.
 * Forges the Supabase auth cookie the same way scripts/prod-smoke.ts does, and
 * always deletes the user, even on throw.
 */
async function withAdminSession<T>(
  service: SupabaseClient,
  fn: (cookie: string) => Promise<T>,
): Promise<T | null> {
  // Create first, and only go looking if the email is already taken. Never
  // delete a `profiles` row by USERNAME: PROBE_USERNAME is reserved, but a
  // service-role delete keyed on a string a stranger could hold is one rename
  // away from wiping a real person's profile.
  const create = () =>
    service.auth.admin.createUser({ email: PROBE_EMAIL, password: PROBE_PW, email_confirm: true });
  let { data: made, error } = await create();
  if (!made?.user?.id) {
    // a previous run was killed before its cleanup; find that user by email
    // across pages and remove it (the profiles row cascades with the auth user)
    let found: string | null = null;
    for (let page = 1; page <= 50 && !found; page++) {
      const { data } = await service.auth.admin.listUsers({ page, perPage: 200 });
      const users = data?.users ?? [];
      found = users.find((u) => u.email === PROBE_EMAIL)?.id ?? null;
      if (users.length < 200) break; // last page
    }
    if (found) {
      await service.auth.admin.deleteUser(found);
      ({ data: made, error } = await create());
    }
  }
  const uid = made?.user?.id;
  if (!uid) {
    warn("could not create the probe admin session", error?.message ?? "unknown error");
    return null;
  }
  // a finally block does not run on SIGINT, and Ctrl-C during a slow upstream
  // call is the likeliest way this ever gets interrupted
  const onSignal = () => {
    void service.auth.admin.deleteUser(uid).finally(() => process.exit(130));
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    // requireParticipant() 401s on a user with NO profile row, before isAdmin
    // ever runs, so a silent insert failure would look like a broken deployment
    const { error: profErr } = await service
      .from("profiles")
      .insert({ user_id: uid, username: PROBE_USERNAME, role: "admin" });
    if (profErr) {
      warn("could not give the probe user a profile", `${profErr.message} - the gated probes will 401`);
    }
    const anon = createClient(SUPA_URL!, ANON!, { auth: { persistSession: false } });
    const { data: si } = await anon.auth.signInWithPassword({ email: PROBE_EMAIL, password: PROBE_PW });
    if (!si?.session) {
      warn("probe admin could not sign in", "skipping the admin-gated probes");
      return null;
    }
    const cookie =
      `sb-${SUPA_REF}-auth-token=base64-` +
      Buffer.from(JSON.stringify(si.session)).toString("base64url");
    return await fn(cookie);
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    const { error: delErr } = await service.auth.admin.deleteUser(uid);
    if (delErr) {
      // loud, because what is left behind is an admin account on production
      fail(
        "the temporary probe admin was deleted",
        `${delErr.message} - DELETE THE USER ${PROBE_EMAIL} IN SUPABASE BY HAND`,
      );
    }
  }
}

// ------------------------------------------------------- A. code / schema / deploy

async function checkParity(service: SupabaseClient, deployedCommit: string | null) {
  head("B. Code, schema and deploy parity");

  // --- migrations on disk vs applied in the database ---
  //
  // The ledger stores the FULL FILENAME ("0044_....sql"), and the runner's rule
  // is set membership, not ordering: it applies any unapplied .sql file even one
  // sorting before an applied one. So this diffs SETS, never maxima.
  //
  // It lists migrations from the DEPLOYED COMMIT, not the working tree. The
  // question that matters is "does the code now serving traffic have a
  // migration the database has not got", and a laptop sitting behind
  // origin/main would answer that with a confident, wrong PASS.
  //
  const dbUrl = process.env.SUPABASE_DB_URL;
  let files: string[] = [];
  let source = "";
  const fromCommit = deployedCommit
    ? git(["ls-tree", "--name-only", deployedCommit, "db/migrations/"])
    : null;
  if (fromCommit) {
    files = fromCommit
      .split("\n")
      .map((p) => p.split("/").pop() ?? "")
      .filter((f) => f.endsWith(".sql"))
      .sort();
    source = `from deployed commit ${deployedCommit!.slice(0, 7)}`;
  } else {
    const entries = readdirSync(join(process.cwd(), "db", "migrations"));
    files = entries.filter((f) => f.endsWith(".sql")).sort();
    source = "from the local working tree";
    const notSql = entries.filter((f) => !f.endsWith(".sql"));
    if (notSql.length) {
      // the runner ignores these without a word, so a half-saved .sql.tmp is silent
      warn("non-.sql files in db/migrations (the runner skips these silently)", notSql.join(", "));
    }
    if (deployedCommit) {
      warn(
        "could not list migrations from the deployed commit",
        `${deployedCommit.slice(0, 7)} is not in this checkout (fetch it); falling back to the working tree`,
      );
    }
  }
  if (!dbUrl) {
    skip("migrations on disk are applied to the database", "SUPABASE_DB_URL not set locally; see .env.example");
    skip("the live call-in cap is 3", "needs the same direct Postgres connection");
  } else {
    const pg = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000, // fail fast rather than hang on the pooler
    });
    try {
      await pg.connect();
      const applied = new Set(
        (await pg.query("select name from public.schema_migrations")).rows.map(
          (r: { name: string }) => r.name,
        ),
      );
      const pending = files.filter((f) => !applied.has(f));
      check(
        "every migration the deployed code expects is applied",
        pending.length === 0,
        pending.length
          ? `PENDING: ${pending.join(", ")} - run npm run migrate NOW; the live code writes these columns`
          : `${files.length} applied, ${source}`,
      );
      const orphans = [...applied].filter((a) => !files.includes(a));
      if (orphans.length) {
        warn("applied migrations with no file on this branch", orphans.join(", "));
      }

      // --- the live call-in cap, read from the deployed function body ---
      const fn = await pg.query(
        "select pg_get_functiondef(oid) as def from pg_proc where proname = 'accept_talk_request' limit 1",
      );
      const def = (fn.rows[0]?.def as string | undefined) ?? "";
      if (!def) {
        fail("accept_talk_request exists in the database", "the call-in accept path will 404");
      } else {
        // 0013 and 0042 are byte-identical apart from the threshold, so the
        // body is the only thing that identifies which version is live.
        // A cap that reads WRONG blocks; a cap that cannot be PARSED is a warn.
        const cap = def.match(/v_on_air\s*>=\s*(\d+)/)?.[1] ?? null;
        if (cap === null) {
          warn("could not read the call-in cap", "the function body did not match the expected shape; check it by hand");
        } else {
          check(
            "call-in cap is 3 guests (migration 0042 is live)",
            cap === "3",
            cap === "3" ? "cap = 3" : `cap = ${cap} - the ${Number(cap) + 1}th caller will be rejected as cap_full`,
          );
        }
      }
    } catch (err) {
      skip("migrations and the live call-in cap", `could not read schema state: ${(err as Error).message}`);
    } finally {
      await pg.end().catch(() => {});
    }
  }

  // --- is the code you are looking at the code that is serving? ---
  const localHead = git(["rev-parse", "HEAD"]);
  git(["fetch", "--quiet", "origin", "main"]); // best effort; offline is fine
  const originMain = git(["rev-parse", "origin/main"]);
  const dirty = git(["status", "--porcelain"]);

  if (!deployedCommit) {
    skip("the deployed commit matches origin/main", "the deployment did not report one (older build, or not on Vercel)");
  } else if (!originMain) {
    skip("the deployed commit matches origin/main", `no git origin/main in this checkout; deployed ${deployedCommit.slice(0, 7)}`);
  } else {
    // WARN, not FAIL: the usual cause is a deploy still building, which fixes
    // itself in two minutes, and every --url preview run would otherwise be
    // permanently red. An operator who learns to ignore red has no preflight.
    check(
      "the deployed commit is origin/main",
      deployedCommit === originMain,
      `deployed ${deployedCommit.slice(0, 7)}, origin/main ${originMain.slice(0, 7)}${
        deployedCommit !== originMain ? " - a deploy may still be building, or this is a preview" : ""
      }`,
      true,
    );
  }
  if (originMain && localHead && originMain !== localHead) {
    warn("your local HEAD is not origin/main", `HEAD ${localHead.slice(0, 7)} - unpushed work is not live`);
  }
  if (dirty) {
    warn("working tree has uncommitted changes", `${dirty.split("\n").length} file(s)`);
  }
}

// ---------------------------------------------------- B. deployment + bundles

type Json = Awaited<ReturnType<typeof getJson>>;
type Probes = {
  health: Json | null;
  ffmpegRecordings: Json | null;
  ffmpegRooms: Json | null;
  sharp: Json | null;
  /** null when there was no fixture to ask about */
  sportmonks: Json | null;
};

/**
 * Everything that needs the elevated cookie, gathered in one short window.
 * The temporary admin account exists only for the duration of these three
 * requests: nothing slow (a Postgres connect, a `git fetch` on a bad network)
 * happens while it is alive.
 */
async function gatherProbes(
  service: SupabaseClient,
  sportmonksFixtureId: number | null,
): Promise<Probes> {
  const empty: Probes = {
    health: null,
    ffmpegRecordings: null,
    ffmpegRooms: null,
    sharp: null,
    sportmonks: null,
  };
  const got = await withAdminSession(service, async (cookie) => {
    const h = { headers: { Cookie: cookie } };
    const health = await getJson(`${BASE}/api/health`, h);
    if (QUICK) return { ...empty, health };
    return {
      health,
      ffmpegRecordings: await getJson(`${BASE}/api/recordings?probe=ffmpeg`, h),
      ffmpegRooms: await getJson(`${BASE}/api/rooms?probe=ffmpeg`, h),
      sharp: await getJson(`${BASE}/api/profile/avatar?probe=sharp`, h),
      sportmonks: sportmonksFixtureId
        ? await getJson(`${BASE}/api/health?probe=sportmonks&fixture=${sportmonksFixtureId}`, h)
        : null,
    };
  }).catch((err) => {
    warn("admin-gated probes failed", (err as Error).message);
    return null;
  });
  return got ?? empty;
}

async function checkDeployment(probes: Probes) {
  head("A. Deployment health");

  const home = await fetch(BASE, { redirect: "manual" }).catch(() => null);
  check("app is deployed and serving", !!home && home.status >= 200 && home.status < 400, home ? `HTTP ${home.status}` : "no response");

  const health = probes.health;
  if (!health) {
    skip("env presence and the in-bundle native probes", "could not open an admin session against the deployment");
    return;
  }
  if (health.status !== 200 || !health.body) {
    fail("/api/health reachable as admin", `HTTP ${health.status}`);
    return;
  }
  // A deployment predating this commit answers 200 with `env` only. Defaulting
  // the new blocks to {} would print "PASS ... 0 present" and silently drop
  // every escalation, including the CRON_SECRET blocker.
  if (health.body.optional === undefined || health.body.hosts === undefined) {
    skip(
      "optional-env escalations and the app-URL host check",
      "this deployment predates the health route's optional/hosts blocks; deploy and re-run",
    );
  }
  const env = (health.body.env ?? {}) as Record<string, boolean>;
  const optional = (health.body.optional ?? {}) as Record<string, boolean>;
  const hosts = (health.body.hosts ?? {}) as Record<string, string | null>;

  // every consumer of SUPABASE_S3_REGION defaults it to us-east-1, so its
  // absence is not a blocker even though /api/health lists it as required
  const SOFT = new Set(["SUPABASE_S3_REGION"]);
  const missing = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
  const hardMissing = missing.filter((k) => !SOFT.has(k));
  if (Object.keys(env).length === 0) {
    // a green "all present" over an empty list is the worst possible output
    skip("required env vars", "the health route returned no env block");
  } else {
    check(
      "all required env vars present in the deployment",
      hardMissing.length === 0,
      hardMissing.length ? `MISSING: ${hardMissing.join(", ")}` : `${Object.keys(env).length} present`,
    );
  }
  for (const k of missing.filter((k) => SOFT.has(k))) {
    warn(`env not set: ${k}`, "consumers fall back to a default");
  }

  // A few "optional" vars are worse than off when absent, so preflight applies
  // its own severity rather than inheriting the route's tiering.
  const ESCALATE: Record<string, { level: Level; why: string }> = {
    CRON_SECRET: {
      level: "FAIL",
      why: "the daily cron hard-401s without it, so fixture sync, reminders and retention have all silently stopped",
    },
    NOTIFY_TOKEN_SECRET: {
      // it falls back to the SERVICE KEY first and only then to the literal, so
      // with the service key set the tokens are still unforgeable
      level: "INFO",
      why: "unsubscribe tokens fall back to signing with the service-role key, which is set, so they are still unforgeable",
    },
    DEV_DOCS_PASSWORD: {
      // middleware.ts calls this fallback intentionally low-stakes (the page is
      // non-secret architecture docs), so this is a note, not a defect
      level: "INFO",
      why: "/dev-docs is on middleware's built-in fallback password; set this if the repo goes public",
    },
    NEXT_PUBLIC_SITE_URL: {
      level: "WARN",
      why: "email and push links fall back to the per-deployment VERCEL_URL, not the production domain",
    },
  };
  const plainOff: string[] = [];
  for (const [k, present] of Object.entries(optional)) {
    if (present) continue;
    const rule = ESCALATE[k];
    if (!rule) plainOff.push(k);
    else emit(rule.level, `env not set: ${k}`, rule.why);
  }
  if (plainOff.length) {
    info("optional env not set (feature off, not broken)", plainOff.join(", "));
  }

  // the domain-cutover trap: links in email, OG cards and push all read this
  const appHost = hosts.NEXT_PUBLIC_APP_URL ?? null;
  const baseHost = new URL(BASE).host;
  if (appHost) {
    check(
      "NEXT_PUBLIC_APP_URL points at the host being tested",
      appHost === baseHost,
      `app url host ${appHost}, testing ${baseHost}${appHost !== baseHost ? " - email links and OG cards will point elsewhere" : ""}`,
      true,
    );
  }

  if (QUICK) {
    // a SKIP, not an INFO: --quick drops the checks this tool exists for, and
    // the summary must say so rather than printing an unqualified READY
    skip("the in-bundle ffmpeg and sharp probes", "--quick was passed");
    return;
  }

  // The whole reason a deployed probe exists: these binaries are always present
  // locally and each has failed only on Vercel.
  // "Not deployed" is detected by the ECHOED probe name, not by a status code.
  // A deployment predating these probes does not 404: /api/recordings falls
  // through to its room-id validation (400 "Invalid room."), and the two routes
  // with no GET answer 405. All of those would read as a binary failure.
  const bundles: [string, Json | null, string][] = [
    ["recordings", probes.ffmpegRecordings, "the manual recut path"],
    ["rooms", probes.ffmpegRooms, "the End Broadcast path that produces every recording"],
  ];
  for (const [name, res, why] of bundles) {
    const r = res ?? { status: 0, body: null };
    if (r.body?.probe !== "ffmpeg") {
      skip(`ffmpeg is present in the ${name} function bundle`, `HTTP ${r.status} - probe not deployed yet; deploy this commit and re-run`);
      continue;
    }
    check(
      `ffmpeg is present in the ${name} function bundle`,
      r.body?.ok === true,
      r.body?.ok
        ? String(r.body.version ?? "").slice(0, 44)
        : `${r.body?.stage ?? "?"}: ${r.body?.error ?? "failed"} - breaks ${why}`,
    );
  }

  const sh = probes.sharp ?? { status: 0, body: null };
  if (sh.body?.probe !== "sharp") {
    skip("sharp loads in the avatar function bundle", `HTTP ${sh.status} - probe not deployed yet; deploy this commit and re-run`);
  } else {
    check(
      "sharp loads in the avatar function bundle",
      sh.body?.ok === true,
      sh.body?.ok ? String(sh.body.version ?? "") : `${sh.body?.error ?? "failed"} - avatar uploads will 500`,
    );
  }
}

// ----------------------------------------------------------- C. live services

async function checkServices(service: SupabaseClient) {
  head("C. Realtime, audio and storage");

  // NAMING RULE for this section: these credentials come from .env.local, not
  // from Vercel. The deployment's copies are only checked for PRESENCE (section
  // A). So every name here says ".env.local" and every failure is a WARN: a key
  // rotated in Vercel but never copied down would otherwise print a confident
  // red "chat will be dead" over a perfectly healthy production.
  //
  // Ably is NOT checked via GET /api/ably/token: that route schedules an
  // opportunistic outbox drain in after(), which sends real emails and web
  // pushes, and a preflight must never do that on match day. A token request is
  // a local HMAC anyway, so it proves the key parses, not that Ably accepts it.
  const ablyKey = process.env.ABLY_API_KEY;
  if (!ablyKey) {
    skip("Ably accepts the key in .env.local", "ABLY_API_KEY not set locally");
  } else {
    try {
      const Ably = (await import("ably")).default;
      const rest = new Ably.Rest({ key: ablyKey });
      await rest.stats({ limit: 1 });
      check("Ably accepts the key in .env.local", true, "chat, links and control transport");
    } catch (err) {
      const msg = (err as Error).message;
      // a key scoped without the `stats` capability is a hardening choice, not
      // a broken key: chat/presence/history would still work fine
      const capability = /capab|permission|40160|40170/i.test(msg);
      warn(
        capability ? "Ably key lacks the stats capability" : "Ably rejected the key in .env.local",
        capability ? `${msg} - cannot verify this way; chat may still be fine` : msg,
      );
    }
  }

  // Minting a LiveKit token is local signing, so it proves the env is set but
  // NOT that LiveKit Cloud accepts the credentials. listRooms is the read-only
  // call that actually talks to them.
  const lkUrl = process.env.LIVEKIT_URL;
  const lkKey = process.env.LIVEKIT_API_KEY;
  const lkSecret = process.env.LIVEKIT_API_SECRET;
  if (!lkUrl || !lkKey || !lkSecret) {
    skip("LiveKit accepts the credentials in .env.local", "LIVEKIT_* not set locally");
  } else {
    try {
      const { RoomServiceClient } = await import("livekit-server-sdk");
      const svc = new RoomServiceClient(lkUrl.replace(/^wss:/, "https:"), lkKey, lkSecret);
      const live = await svc.listRooms();
      check("LiveKit accepts the credentials in .env.local", true, `${live.length} room(s) open`);
      for (const r of live) {
        info("LiveKit room already open", `${r.name}, ${r.numParticipants} participant(s)`);
      }
    } catch (err) {
      warn("LiveKit rejected the credentials in .env.local", (err as Error).message);
    }
  }

  const { data: buckets, error: bucketErr } = await service.storage.listBuckets();
  if (bucketErr) {
    fail("Supabase Storage reachable with the service key", bucketErr.message);
  } else {
    const names = (buckets ?? []).map((b) => b.name);
    for (const need of ["recordings", "avatars"]) {
      check(`storage bucket "${need}" exists`, names.includes(need), names.includes(need) ? "" : "uploads to it will fail");
    }
  }

  // EGRESS QUOTA (2026-08-21). listRooms proves the credentials; it says
  // NOTHING about egress. The Build plan's 60 included minutes ran out mid
  // live-test and every broadcast after that silently lost its recording and
  // radio: /api/rooms 'start' catches the "egress minutes exceeded" error,
  // logs it server-side, and the show carries on looking normal. The only
  // truthful test is starting a real egress, so this starts one on a scratch
  // LiveKit room and stops it immediately. This is preflight's second
  // sanctioned write (with the throwaway admin): it costs roughly one
  // audio-only egress minute of billing, and the scratch room, egress and any
  // uploaded scrap are cleaned up in a finally.
  if (QUICK) {
    skip("egress quota (recording + radio)", "--quick was passed");
  } else if (!lkUrl || !lkKey || !lkSecret) {
    skip("egress quota (recording + radio)", "LIVEKIT_* not set locally");
  } else {
    const SCRATCH = "preflight-egress-probe";
    const SCRATCH_PATH = "preflight-probe/egress-check.mp4";
    let egressId: string | null = null;
    try {
      const { EgressClient, EncodedFileOutput, EncodedFileType, RoomServiceClient, S3Upload } =
        await import("livekit-server-sdk");
      const http = lkUrl.replace(/^wss:/, "https:");
      const rooms = new RoomServiceClient(http, lkKey, lkSecret);
      await rooms.createRoom({ name: SCRATCH, emptyTimeout: 60 });
      const eg = new EgressClient(http, lkKey, lkSecret);
      const info = await eg.startRoomCompositeEgress(
        SCRATCH,
        {
          file: new EncodedFileOutput({
            fileType: EncodedFileType.MP4,
            filepath: SCRATCH_PATH,
            output: {
              case: "s3",
              value: new S3Upload({
                endpoint: process.env.SUPABASE_S3_ENDPOINT!,
                accessKey: process.env.SUPABASE_S3_ACCESS_KEY!,
                secret: process.env.SUPABASE_S3_SECRET_KEY!,
                region: process.env.SUPABASE_S3_REGION || "us-east-1",
                bucket: "recordings",
                forcePathStyle: true,
              }),
            },
          }),
        },
        { audioOnly: true },
      );
      egressId = info.egressId;
      // the quota refusal happens AT start ("egress minutes exceeded"), so
      // reaching here IS the proof; stop straight away to spend the minimum
      check("egress quota available (recording + radio will start)", true, `probe egress ${info.egressId} started`);
      for (let i = 0; i < 5; i++) {
        try {
          await eg.stopEgress(info.egressId);
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 2000)); // still STARTING; retry
        }
      }
      await rooms.deleteRoom(SCRATCH).catch(() => {});
    } catch (err) {
      const msg = (err as Error).message;
      if (/minutes exceeded|quota|limit/i.test(msg)) {
        fail(
          "egress quota available (recording + radio will start)",
          `${msg} - the show will look normal but NOTHING will be recorded. Fix billing at cloud.livekit.io before going live.`,
        );
      } else {
        warn("egress quota probe did not complete", msg);
      }
    } finally {
      // scrap file may land after the stop; best-effort delete either way
      await service.storage.from("recordings").remove([SCRATCH_PATH]).catch(() => {});
    }
  }
}

// -------------------------------------------------------------- D. tonight

type RoomRow = {
  id: string;
  slug: string;
  kind: "match" | "discussion";
  title: string | null;
  state: string;
  fixture_id: number | null;
  linked_fixture_id: number | null;
  commentator_id: string;
  broadcast_start: string | null;
  scheduled_kickoff: string | null;
};

const AUDIO_STATES = ["waiting", "pregame", "live_1h", "halftime", "live_2h", "extra_time", "postgame"];

/** The room that is live now, else the soonest one still ahead of us. */
async function pickRoom(service: SupabaseClient): Promise<RoomRow | null> {
  const cols =
    "id, slug, kind, title, state, fixture_id, linked_fixture_id, commentator_id, broadcast_start, scheduled_kickoff";
  if (ROOM_ARG) {
    const bySlug = await service.from("rooms").select(cols).eq("slug", ROOM_ARG).maybeSingle<RoomRow>();
    if (bySlug.data) return bySlug.data;
    const byId = await service.from("rooms").select(cols).eq("id", ROOM_ARG).maybeSingle<RoomRow>();
    return byId.data ?? null;
  }
  // Only End Broadcast sets 'wrapped', so a host who just closed the tab leaves
  // a room in postgame FOREVER. Without a recency window the auto-pick would
  // silently report on last Saturday's match and print a confident green.
  const recent = new Date(Date.now() - 12 * 3600_000).toISOString();
  const liveNow = await service
    .from("rooms").select(cols).in("state", AUDIO_STATES)
    .gte("scheduled_kickoff", recent)
    .order("broadcast_start", { ascending: false }).limit(1).maybeSingle<RoomRow>();
  if (liveNow.data) return liveNow.data;

  const soon = await service
    .from("rooms").select(cols).eq("state", "scheduled")
    .gte("scheduled_kickoff", new Date(Date.now() - 3 * 3600_000).toISOString())
    .order("scheduled_kickoff", { ascending: true }).limit(1).maybeSingle<RoomRow>();
  if (soon.data) return soon.data;

  // nothing current: fall back to any open room so a stuck one is at least
  // VISIBLE, and let checkTonight flag its age
  const stale = await service
    .from("rooms").select(cols).in("state", AUDIO_STATES)
    .order("scheduled_kickoff", { ascending: false }).limit(1).maybeSingle<RoomRow>();
  return stale.data ?? null;
}

/**
 * The target is resolved BEFORE the admin session opens, because the
 * deployment-side Sportmonks probe needs the fixture id and the elevated
 * account should not stay alive while we go looking for it.
 */
type Target = {
  room: RoomRow | null;
  fx: {
    id: number;
    sportmonks_fixture_id: number | null;
    home_team: string;
    away_team: string;
    kickoff_utc: string;
  } | null;
};

async function resolveTarget(service: SupabaseClient): Promise<Target> {
  const room = await pickRoom(service);
  if (!room) return { room: null, fx: null };
  const statsId = room.kind === "discussion" ? room.linked_fixture_id : room.fixture_id;
  if (statsId == null) return { room, fx: null };
  const { data } = await service
    .from("fixtures")
    .select("id, sportmonks_fixture_id, home_team, away_team, kickoff_utc")
    .eq("id", statsId)
    .maybeSingle<Target["fx"]>();
  return { room, fx: data ?? null };
}

async function checkTonight(service: SupabaseClient, target: Target, probes: Probes) {
  const { room, fx } = target;
  head("D. Tonight's room and match data");

  if (!room) {
    // an operator who NAMED a room believes it was checked, so a typo or a
    // wrong-project slug has to block; an empty auto-pick is just a warning
    if (ROOM_ARG) {
      fail("the room named by --room exists", `nothing matched "${ROOM_ARG}" - NOTHING in this section ran`);
    } else {
      warn("no live or upcoming room found", "create the room, then re-run");
    }
    return;
  }
  const label = room.title ?? room.slug;
  info("room under test", `${label}  [${room.kind}, state=${room.state}]`);
  info("room url", `${BASE}/room/${room.slug}`);

  // terminal states can still be selected by --room, and would otherwise sail
  // through every check below looking healthy
  if (room.state === "canceled" || room.state === "wrapped") {
    fail(`the room is not ${room.state}`, "nobody can go on air in it; open or create a room");
    return;
  }
  const ageH = Math.round((Date.now() - new Date(room.scheduled_kickoff ?? 0).getTime()) / 3600_000);
  if (ageH > 12) {
    warn("this room is not from today", `its kickoff was ~${ageH}h ago - is this really tonight's room?`);
  }

  // --- schedule sanity ---
  if (room.state === "scheduled") {
    if (!room.broadcast_start) {
      warn("no broadcast_start set", "the waiting room shows the calm 'show starts soon' card, with no countdown");
    } else {
      const mins = Math.round((new Date(room.broadcast_start).getTime() - Date.now()) / 60000);
      const when = new Date(room.broadcast_start).toLocaleString("en-GB", { timeZone: "Europe/London" });
      if (mins < -120) {
        fail("broadcast_start is in the past", `${when} London, ${-mins} min ago - the no-show sweep may cancel this room`);
      } else {
        info("broadcast starts", `${when} London (${mins >= 0 ? `in ${mins}` : `${-mins} min ago`} min)`);
      }
    }
    warn("room is still SCHEDULED", "open the waiting room from /room/" + room.slug + " when you are ready");
  }
  if (room.state === "waiting") {
    // /api/talk's OPEN_STATES deliberately excludes 'waiting'
    info("call-ins are not open yet", "they open when you Start Broadcast; 'waiting' is listen-and-chat only");
  }

  // --- the hosts ---
  // commentator_id is creator-of-record only; every host decision in the app
  // routes through room_hosts (status='accepted'), so that is what to verify.
  const { data: hostRows } = await service
    .from("room_hosts")
    .select("user_id, status")
    .eq("room_id", room.id)
    .eq("status", "accepted");
  const hostIds = (hostRows ?? []).map((h) => h.user_id as string);
  check(
    "the room has at least one accepted host",
    hostIds.length > 0,
    hostIds.length ? `${hostIds.length} host(s)` : "nobody can go on air in this room",
  );
  if (hostIds.length) {
    const { data: profs } = await service
      .from("profiles")
      .select("user_id, username, role")
      .in("user_id", hostIds);
    const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim());
    for (const uid of hostIds) {
      const p = (profs ?? []).find((x) => x.user_id === uid) as
        | { username: string; role: string }
        | undefined;
      if (!p) {
        fail("host has a profile", `accepted host ${uid.slice(0, 8)} has no profiles row`);
        continue;
      }
      // The publish gate is isRoomHost || isAdmin - the profile ROLE is not
      // consulted, so the accepted room_hosts row above already proves they can
      // go on air. A demoted role is worth flagging (it blocks creating the
      // NEXT room) but must not block tonight.
      const ok = p.role === "commentator" || p.role === "admin" || adminIds.includes(uid);
      check(`host still holds the commentator role: ${p.username}`, ok, ok ? `role=${p.role}` : `role=${p.role} - they can still go on air in this room, but cannot create new ones`, true);
    }
  }
  const pendingInvites = ((await service
    .from("room_hosts")
    .select("user_id")
    .eq("room_id", room.id)
    .eq("status", "invited")).data ?? []).length;
  if (pendingInvites) {
    warn("co-host invite still pending", `${pendingInvites} invited host(s) have not accepted, so they cannot go on air`);
  }

  // --- the stats chain, link by link ---
  const statsId = room.kind === "discussion" ? room.linked_fixture_id : room.fixture_id;
  if (!fx) {
    if (statsId == null && room.kind === "discussion") {
      info("no fixture linked", "by design for a discussion room: no scoreboard, no stats panel");
    } else if (statsId == null) {
      fail("match room has a fixture", "fixture_id is null on a match room");
    } else {
      fail("the room's fixture exists in our fixtures table", `no row with id ${statsId}`);
    }
    return;
  }
  info("fixture", `${fx.home_team} vs ${fx.away_team}, kickoff ${new Date(fx.kickoff_utc).toLocaleString("en-GB", { timeZone: "Europe/London" })} London`);

  // This is the Betis trap. A synthetic/admin fixture with no Sportmonks id
  // never calls upstream: the room quietly shows zeros for the whole match.
  check(
    "fixture is linked to a Sportmonks fixture",
    fx.sportmonks_fixture_id != null,
    fx.sportmonks_fixture_id != null
      ? `sportmonks id ${fx.sportmonks_fixture_id}`
      : "stats, lineups and the scoreboard will show zeros ALL MATCH - link it before you go live",
  );
  if (fx.sportmonks_fixture_id == null) return;

  // ORDER MATTERS. Establish the token/plan verdict FIRST, then use it to grade
  // what our own pipeline serves. Without it a `stale` payload is unreadable:
  // it means "revoked token" and "Sportmonks is having a bad minute"
  // identically, and grading the benign case red is how a preflight gets
  // ignored. The verdict comes from THE DEPLOYMENT's probe where possible,
  // because Vercel's token is the one that produced the payload; the laptop's
  // token is only a fallback and is labelled as such.
  const upstream = readSportmonksProbe(probes.sportmonks)
    ?? (await sportmonksVerdict(fx.sportmonks_fixture_id));

  // End to end through the real public route: proves OUR deployment can reach
  // the data, with the token that is set in Vercel rather than the laptop's.
  // One retry, because a cold lambda plus a slow upstream regularly costs the
  // first call and a flaky check trains you to ignore it.
  let stats = await getJson(`${BASE}/api/stats/${fx.id}`);
  if (stats.status !== 200) {
    await new Promise((r) => setTimeout(r, 3000));
    stats = await getJson(`${BASE}/api/stats/${fx.id}`);
  }
  if (stats.status === 503) {
    fail("live stats resolve for this fixture", `Sportmonks error: ${stats.body?.error ?? "unknown"} - check the plan covers this competition`);
    return;
  }
  if ([408, 502, 504, 0].includes(stats.status)) {
    // the gateway gave up waiting; that is upstream latency, not a misconfig
    warn("stats request timed out", `HTTP ${stats.status} - Sportmonks is slow right now, re-run in a minute`);
    return;
  }
  if (stats.status !== 200 || !stats.body) {
    fail("live stats resolve for this fixture", `HTTP ${stats.status}`);
    return;
  }
  const home = stats.body.home as { id: number | null; name: string } | undefined;
  const away = stats.body.away as { id: number | null; name: string } | undefined;
  const status = stats.body.status as { short: string; name: string } | undefined;
  const score = stats.body.score as { home: number; away: number } | undefined;
  const isZeros = !home?.id || !away?.id || home.name === "Home";
  check(
    "Sportmonks returns REAL data for this fixture",
    !isZeros,
    isZeros
      ? "got the zeros placeholder - the token, the fixture id or the plan's competition coverage is wrong"
      : `${home!.name} ${score?.home ?? 0} - ${score?.away ?? 0} ${away!.name}  [${status?.name ?? "?"}]`,
  );
  // `stale` means the LIVE call failed and this is last-good memory or the
  // daily-warmed snapshot. The numbers LOOK real, which is the danger. Graded
  // by the upstream verdict: a healthy token means our cache is papering over a
  // blip (bad, worth knowing, not a blocker), while a broken or unproven token
  // means the numbers on screen are dead and nobody would be able to tell.
  if (stats.body.stale === true) {
    emit(
      upstream === "ok" ? "WARN" : "FAIL",
      "the stats payload is live, not a stale fallback",
      upstream === "ok"
        ? "served from cache after a failed upstream call; the token is fine, so this should clear on its own"
        : "served from cache AND the token could not be verified - assume the numbers are dead",
    );
  } else {
    check("the stats payload is live, not a stale fallback", true);
  }
  if (!isZeros) {
    const lineups = stats.body.lineups as { home: unknown[] | null } | undefined;
    info(
      "lineups",
      lineups?.home ? "published" : "not published yet (normal until ~1h before kickoff)",
    );
  }
}

type Upstream = "ok" | "broken" | "unknown";

/**
 * The authoritative verdict: the deployment asked Sportmonks with ITS OWN
 * token. Returns null when this deployment has no such probe (older build), in
 * which case the caller falls back to checking the laptop's token and says so.
 */
function readSportmonksProbe(res: Json | null): Upstream | null {
  if (!res || res.body?.probe !== "sportmonks") return null;
  const b = res.body as { ok?: boolean; status?: number; league?: string | null; reason?: string };
  if (b.ok) {
    check("Sportmonks accepts the DEPLOYMENT's token", true, `league: ${b.league ?? "unknown"}`);
    return "ok";
  }
  if (b.status === 401 || b.status === 403) {
    fail(
      b.status === 403 ? "the deployment's Sportmonks plan covers this competition" : "Sportmonks accepts the DEPLOYMENT's token",
      `${b.reason ?? `HTTP ${b.status}`} - this is Vercel's token, so the room WILL show placeholder data`,
    );
    return "broken";
  }
  warn("could not verify the deployment's Sportmonks token", b.reason ?? "upstream did not answer");
  return "unknown";
}

/**
 * One direct Sportmonks call, bypassing our cache entirely. getFixtureStats
 * holds last-good in memory FOREVER on error, so a warm lambda can serve a good
 * payload minutes after the token was revoked or the plan lapsed. This is also
 * the check that names the Betis failure precisely: a 403 means the competition
 * is outside the plan, which nothing else in the stack reports.
 */
async function sportmonksVerdict(sportmonksId: number): Promise<Upstream> {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) {
    skip("Sportmonks token validity", "no deployment probe and SPORTMONKS_API_TOKEN is not set locally");
    return "unknown";
  }
  const base = process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";
  try {
    // raw token, NO "Bearer " prefix - that is how every caller in lib/ does it
    const res = await fetch(`${base}/fixtures/${sportmonksId}?include=league`, {
      headers: { Authorization: token },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) {
      fail("Sportmonks accepts the token in .env.local", "HTTP 401 - the token is wrong or revoked");
      return "broken";
    }
    if (res.status === 403) {
      fail(
        "the Sportmonks plan covers this competition",
        "HTTP 403 - the fixture exists but the plan does not include its league. Add it in the Sportmonks dashboard.",
      );
      return "broken";
    }
    if (res.status === 429) {
      warn("Sportmonks rate limited this check", "HTTP 429 - retry in a minute");
      return "unknown";
    }
    if (!res.ok) {
      // 5xx is Sportmonks wobbling, not something you can fix before kickoff
      warn("Sportmonks is not responding normally", `HTTP ${res.status} - upstream problem, not a config problem`);
      return "unknown";
    }
    const body = (await res.json()) as { data?: { league?: { name?: string } } };
    check(
      "Sportmonks accepts the token in .env.local",
      true,
      `league: ${body.data?.league?.name ?? "unknown"} (the deployment's own token was not probed)`,
    );
    return "ok";
  } catch (err) {
    warn("could not reach Sportmonks", (err as Error).message);
    return "unknown";
  }
}

// ------------------------------------------------------------------- run

async function main() {
  console.log(`\nArseradio preflight`);
  console.log(`${C.dim}target ${BASE}${C.off}`);

  const service = createClient(SUPA_URL!, SERVICE_KEY!, { auth: { persistSession: false } });

  // Everything needing the elevated cookie happens here and nowhere else, so
  // the temporary admin account's lifetime is three HTTP requests rather than
  // the whole run.
  // resolved first, and outside the session, so the deployment-side Sportmonks
  // probe knows which fixture to ask about
  const target = await resolveTarget(service);
  const probes = await gatherProbes(service, target.fx?.sportmonks_fixture_id ?? null);
  const deployedCommit =
    (probes.health?.body?.deploy as { commit?: string } | undefined)?.commit ?? null;

  await checkDeployment(probes);
  await checkParity(service, deployedCommit);
  await checkServices(service);
  await checkTonight(service, target, probes);

  const failures = rows.filter((r) => r.level === "FAIL");
  const warnings = rows.filter((r) => r.level === "WARN");
  const skipped = rows.filter((r) => r.level === "SKIP");
  const passed = rows.filter((r) => r.level === "PASS");

  console.log(`\n${C.dim}${"=".repeat(66)}${C.off}`);
  if (failures.length === 0) {
    // "READY" must never imply coverage it does not have, so the headline
    // carries the skip count rather than hiding it below the fold
    const caveat = skipped.length ? `, ${C.SKIP}${skipped.length} NOT CHECKED${C.off}` : "";
    console.log(`${C.PASS}READY${C.off}  ${passed.length} checks passed${warnings.length ? `, ${warnings.length} warning(s)` : ""}${caveat}`);
  } else {
    console.log(`${C.FAIL}NOT READY${C.off}  ${failures.length} blocking issue(s)${warnings.length ? `, ${warnings.length} warning(s)` : ""}${skipped.length ? `, ${skipped.length} not checked` : ""}\n`);
    for (const f of failures) console.log(`  ${C.FAIL}x${C.off} ${f.name}${f.detail ? `\n      ${C.dim}${f.detail}${C.off}` : ""}`);
  }
  if (skipped.length) {
    console.log(`\n${C.SKIP}could not be checked (this run proves nothing about these):${C.off}`);
    for (const s of skipped) console.log(`  ${C.SKIP}?${C.off} ${s.name}${s.detail ? ` ${C.dim}${s.detail}${C.off}` : ""}`);
  }
  if (warnings.length) {
    console.log(`\n${C.dim}warnings (not blocking):${C.off}`);
    for (const w of warnings) console.log(`  ${C.WARN}!${C.off} ${w.name}${w.detail ? ` ${C.dim}${w.detail}${C.off}` : ""}`);
  }
  console.log("");
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
