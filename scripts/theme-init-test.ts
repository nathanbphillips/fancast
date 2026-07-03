/** Unit test for the pre-paint theme script (audit M-11/L-3). npm run test:theme */
import { themeInitScript } from "../lib/theme";

let failures = 0;
function ok(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const dark = themeInitScript("dark");
const light = themeInitScript("light");
const none = themeInitScript(null);

// account pref is baked in as a string literal
ok('dark bakes in "dark"', dark.includes('var acct="dark"'));
ok('light bakes in "light"', light.includes('var acct="light"'));
ok("null bakes in empty string", none.includes('var acct=""'));

// PRECEDENCE: the localStorage (device choice) branch must be read BEFORE the
// account branch, so an explicit device tap always wins (CLAUDE.md contract).
for (const [label, s] of [["dark", dark], ["null", none]] as const) {
  const lsIdx = s.indexOf('localStorage.getItem("theme")');
  const acctIdx = s.indexOf("var acct=");
  ok(`${label}: localStorage checked before account pref`, lsIdx >= 0 && lsIdx < acctIdx, `ls@${lsIdx} acct@${acctIdx}`);
}

// Cloud Design (2026-07-01): the final fallback is DARK, not the system
// preference — precedence is localStorage > account pref > dark default.
ok("falls back to dark default", dark.includes('var d=t?t==="dark":true'));
ok(
  "prefers-color-scheme fallback removed",
  !dark.includes("prefers-color-scheme"),
);
// @ts-expect-error — guard against a bad value sneaking through
ok("invalid pref => empty", themeInitScript("blue").includes('var acct=""'));

console.log(failures === 0 ? "\nALL THEME TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
