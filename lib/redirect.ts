/**
 * Only accept a same-origin absolute path for a post-login redirect (M-2,
 * audit). Must start with exactly one "/" and NOT "//" or "/\" — both of those
 * resolve to an off-origin authority via `new URL(next, origin)` and are the
 * open-redirect / phishing vector. Anything else falls back to "/".
 *
 * Hardening (2026-06-23 audit, H-A): the WHATWG URL parser strips leading C0
 * control chars / whitespace BEFORE parsing, so a smuggled "/\t//evil.com"
 * (wire `?next=/%09//evil.com`, which searchParams.get decodes to a literal
 * tab) sailed past the old prefix check and `new URL()` resolved it to
 * https://evil.com/. We now (1) reject any control char or whitespace, then
 * (2) re-confirm same-origin by actually parsing against a fixed base and
 * returning only the normalized path+query+fragment.
 */
export function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  // reject any C0 control char or space (code point <= 0x20) or DEL (0x7f) —
  // these are smuggling vectors the URL parser strips before parsing
  // (e.g. a leading tab turns "/\t//evil.com" into the authority "//evil.com")
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c <= 0x20 || c === 0x7f) return "/";
  }
  if (raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") return "/";
  try {
    const base = "https://fc.invalid";
    const u = new URL(raw, base);
    if (u.origin !== base) return "/"; // escaped to another origin/scheme
    const path = u.pathname + u.search + u.hash;
    // path NORMALIZATION can re-introduce a leading "//": e.g. "/..//evil.com"
    // collapses to pathname "//evil.com" (origin stays fc.invalid, so the check
    // above passes), and the CALLER's new URL(path, appOrigin) would then treat
    // "//evil.com" as a protocol-relative authority → off-origin. Re-apply the
    // single-leading-slash guard to the OUTPUT, not just the raw input.
    if (path[0] !== "/" || path[1] === "/" || path[1] === "\\") return "/";
    return path;
  } catch {
    return "/";
  }
}
