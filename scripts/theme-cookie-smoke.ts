/**
 * Verifies the theme no-flash wiring (audit M-11/L-3) end-to-end:
 *  - PATCH /api/profile theme_pref sets/clears the readable fc_theme cookie
 *  - the root layout bakes that cookie value into the pre-paint script
 *   npm run smoke:theme / -- clean
 */
import { createClient, type Session } from "@supabase/supabase-js";
import "dotenv/config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP = "http://localhost:3000";
const PROJECT_REF = new URL(URL_).hostname.split(".")[0];
const PASSWORD = "theme-Pass-1!";
const EMAIL = "fancast.theme.u@example.com";
const USERNAME = "theme_u";

const service = createClient(URL_, SERVICE, { auth: { persistSession: false } });
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
function cookieFor(s: Session) {
  return `sb-${PROJECT_REF}-auth-token=base64-` + Buffer.from(JSON.stringify(s)).toString("base64url");
}
async function clean() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email === EMAIL);
  if (u) await service.auth.admin.deleteUser(u.id);
  console.log("clean done");
}

async function main() {
  if (process.argv[2] === "clean") return clean();
  await clean();

  const { data: created } = await service.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: si } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookie = cookieFor(si!.session!);
  await fetch(`${APP}/api/profile`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ username: USERNAME }) });
  void created;

  async function patch(theme: "dark" | "light" | null) {
    const res = await fetch(`${APP}/api/profile`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ theme_pref: theme }),
    });
    return res.headers.get("set-cookie") ?? "";
  }

  let sc = await patch("dark");
  check("PATCH dark sets fc_theme=dark", /fc_theme=dark/.test(sc), sc);
  sc = await patch("light");
  check("PATCH light sets fc_theme=light", /fc_theme=light/.test(sc), sc);
  sc = await patch(null);
  check("PATCH null clears fc_theme (Max-Age=0 / expired)", /fc_theme=;?/.test(sc) && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(sc), sc);

  // root layout bakes the cookie into the pre-paint script
  async function bakedAcct(themeCookie?: string) {
    const res = await fetch(`${APP}/`, { headers: themeCookie ? { Cookie: `fc_theme=${themeCookie}` } : {} });
    const html = await res.text();
    const m = html.match(/var acct=("?\w*"?)/);
    return m?.[1] ?? "(none)";
  }
  check('GET / with fc_theme=dark bakes var acct="dark"', (await bakedAcct("dark")) === '"dark"');
  check('GET / with fc_theme=light bakes var acct="light"', (await bakedAcct("light")) === '"light"');
  check('GET / with no cookie bakes var acct=""', (await bakedAcct()) === '""');
  check('GET / with junk cookie bakes var acct="" (rejected)', (await bakedAcct("purple")) === '""');

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
