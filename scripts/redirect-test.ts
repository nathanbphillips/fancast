/** Unit test for the auth-callback open-redirect guard (audit M-2). npm run test:redirect */
import { safeNextPath } from "../lib/redirect";

let failures = 0;
function eq(name: string, got: string, want: string) {
  const ok = got === want;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failures++;
}

// blocked → fall back to "/"
eq("null", safeNextPath(null), "/");
eq("empty", safeNextPath(""), "/");
eq("absolute https", safeNextPath("https://evil.com"), "/");
eq("protocol-relative //", safeNextPath("//evil.com"), "/");
eq("backslash authority /\\", safeNextPath("/\\evil.com"), "/");
eq("double backslash \\\\", safeNextPath("\\\\evil.com"), "/");
eq("scheme without slash", safeNextPath("http:evil"), "/");
eq("bare word", safeNextPath("evil.com"), "/");

// allowed → preserved verbatim (incl. query + fragment)
eq("root", safeNextPath("/"), "/");
eq("welcome", safeNextPath("/welcome"), "/welcome");
eq("deep link w/ query+hash", safeNextPath("/room/123?tab=chat#x"), "/room/123?tab=chat#x");

// control-char-smuggled authority is rejected (2026-06-23 audit H-A): the URL
// parser strips a leading tab/newline/CR, turning these into "//evil.com".
eq("tab-smuggled // authority rejected", safeNextPath("/\t//evil.com"), "/");
eq("tab single-slash rejected", safeNextPath("/\t/evil.com"), "/");
eq("newline-smuggled authority rejected", safeNextPath("/\n//evil.com"), "/");
eq("CR-smuggled authority rejected", safeNextPath("/\r//evil.com"), "/");
eq("leading space rejected", safeNextPath(" /evil.com"), "/");

// path-traversal that NORMALIZES to a protocol-relative authority (2026-06-23
// re-audit): the URL parser collapses "/.." so pathname becomes "//evil.com".
eq("traversal -> // authority rejected", safeNextPath("/..//evil.com"), "/");
eq("nested traversal -> // rejected", safeNextPath("/foo/../..//evil.com"), "/");
eq("traversal off-host w/ path rejected", safeNextPath("/a/../..//attacker.example/phish"), "/");
// a benign traversal that stays a single-slash same-origin path is preserved
eq("benign traversal normalizes to same-origin", safeNextPath("/room/../lobby"), "/lobby");

console.log(failures === 0 ? "\nALL REDIRECT TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
