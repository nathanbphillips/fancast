/** Unit test for the auth-callback open-redirect guard (audit M-2). npm run test:redirect */
import { safeNextPath } from "../app/auth/callback/route";

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
eq("tab smuggle stays same-origin path", safeNextPath("/\t/evil.com"), "/\t/evil.com");

console.log(failures === 0 ? "\nALL REDIRECT TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
