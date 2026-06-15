/** Unit test for the unfurler SSRF guards (audit H-2). npm run test:ssrf */
import assert from "node:assert/strict";
import { assertPublicUrl, isPrivateIp } from "../lib/unfurl";

let failures = 0;
function ok(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}
async function blocks(url: string) {
  try {
    await assertPublicUrl(new URL(url));
    return false;
  } catch {
    return true;
  }
}
async function allows(url: string) {
  try {
    await assertPublicUrl(new URL(url));
    return true;
  } catch (e) {
    console.log("   (allow check threw:", (e as Error).message, ")");
    return false;
  }
}

async function main() {
  // private/reserved IPs are recognized
  for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "172.31.255.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    ok(`isPrivateIp(${ip})`, isPrivateIp(ip) === true);
  }
  // public IPs are not flagged
  for (const ip of ["8.8.8.8", "1.1.1.1", "151.101.1.140", "2606:4700::1111"]) {
    ok(`isPrivateIp(${ip}) === false`, isPrivateIp(ip) === false);
  }

  // assertPublicUrl blocks the dangerous targets
  ok("blocks http://127.0.0.1/", await blocks("http://127.0.0.1/"));
  ok("blocks http://169.254.169.254/ (cloud metadata)", await blocks("http://169.254.169.254/latest/meta-data/"));
  ok("blocks http://localhost/", await blocks("http://localhost/"));
  ok("blocks http://[::1]/", await blocks("http://[::1]/"));
  ok("blocks file: scheme", await blocks("file:///etc/passwd"));
  ok("blocks *.internal host", await blocks("http://metadata.google.internal/"));
  // decimal-encoded 127.0.0.1 (2130706433) — relies on OS resolver
  const decimalBlocked = await blocks("http://2130706433/");
  ok("blocks decimal-IP literal (best-effort)", decimalBlocked, decimalBlocked ? "" : "resolver did not map it; covered on Linux/Vercel");

  // a real public host is allowed
  ok("allows https://example.com/", await allows("https://example.com/"));

  console.log(failures === 0 ? "\nALL SSRF TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
