/**
 * Theme no-flash plumbing (M-11, audit). The signed-in user's account theme
 * (profiles.theme_pref) is mirrored into a readable `fc_theme` cookie so the
 * pre-paint inline script can apply it before first paint — no post-hydration
 * flip on a fresh device whose system theme differs from the account theme.
 */

export const THEME_COOKIE = "fc_theme";
export type ThemeChoice = "dark" | "light";

/**
 * Cookie must be readable by the pre-paint inline script, so NOT httpOnly.
 * Theme is non-sensitive and never trusted for authz. `secure` only in prod
 * so local http dev still sets it. One year, lax, site-wide.
 */
export const themeCookieOptions = {
  httpOnly: false,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Pre-paint theme script. Precedence (per CLAUDE.md): an explicit device
 * choice in localStorage wins, else the server-baked account preference, else
 * the system preference. The localStorage branch MUST stay before the account
 * branch — that ordering is the device-beats-account contract.
 */
export function themeInitScript(accountPref: ThemeChoice | null): string {
  const pref =
    accountPref === "dark" || accountPref === "light" ? accountPref : "";
  return (
    `(function(){try{` +
    `var ls=localStorage.getItem("theme");` +
    `var acct=${JSON.stringify(pref)};` +
    `var t=ls?ls:(acct?acct:null);` +
    `var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;` +
    `document.documentElement.classList.toggle("dark",d);` +
    `}catch(e){}})();`
  );
}
