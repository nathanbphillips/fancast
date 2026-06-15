/**
 * Only accept a same-origin absolute path for a post-login redirect (M-2,
 * audit). Must start with exactly one "/" and NOT "//" or "/\" — both of those
 * resolve to an off-origin authority via `new URL(next, origin)` and are the
 * open-redirect / phishing vector. Anything else falls back to "/".
 */
export function safeNextPath(raw: string | null): string {
  if (!raw || raw[0] !== "/") return "/";
  if (raw[1] === "/" || raw[1] === "\\") return "/";
  return raw;
}
