import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * Server-side OG unfurl (FR-9.1). Fetches the page, extracts Open Graph
 * tags with a title fallback.
 *
 * SSRF defense (audit H-2): redirects are followed MANUALLY and every hop
 * is validated BEFORE the request fires; each hostname is DNS-resolved and
 * rejected if it maps to any private/reserved IP (defeats decimal/hex IP
 * literals and internal DNS names, not just dotted-quad/localhost). https/
 * http only, 8s timeout, 1.5MB read cap, max 4 redirect hops.
 */

export type Unfurled = {
  title: string | null;
  description: string | null;
  image: string | null;
};

const MAX_BYTES = 1536 * 1024; // YouTube parks its meta ~640KB deep
const MAX_REDIRECTS = 4;

/** Cheap synchronous gate for submit-time UX (protocol + obvious literals).
 *  The authoritative SSRF check is assertPublicUrl (async, DNS-based). */
export function isFetchableUrl(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  return true;
}

/** True if an IP string is loopback/private/link-local/reserved. Exported
 *  for tests. */
export function isPrivateIp(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return isPrivateV4(ip);
  if (fam === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    // IPv4-mapped (::ffff:a.b.c.d)
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateV4(mapped[1]);
    // ULA fc00::/7 (fc, fd) and link-local fe80::/10 (fe8..feb)
    if (/^f[cd]/.test(lower)) return true;
    if (/^fe[89ab]/.test(lower)) return true;
    return false;
  }
  return true; // not a recognizable IP → treat as unsafe
}

function isPrivateV4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // this-net, private, loopback
  if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24
  if (a >= 224) return true; // multicast + reserved (224.0.0.0+)
  return false;
}

/** Throws if the URL is not a public http(s) target. Resolves DNS so a
 *  numeric/encoded host or an internal name that maps to a private IP is
 *  rejected. Exported for tests. */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (!isFetchableUrl(url)) throw new Error("blocked: scheme/host");
  const host = url.hostname;
  // literal IP — check directly
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("blocked: private IP literal");
    return;
  }
  // resolve all addresses; reject if ANY is private (covers split-horizon)
  const addrs = await lookup(host, { all: true });
  if (addrs.length === 0) throw new Error("blocked: unresolvable host");
  for (const { address } of addrs) {
    if (isPrivateIp(address)) throw new Error("blocked: resolves to private IP");
  }
}

function metaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function resolveImageUrl(raw: string | null, pageUrl: string): string | null {
  if (!raw) return null;
  try {
    const resolved = new URL(raw, pageUrl);
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

/** Fetch following redirects manually, validating each hop first. */
async function safeFetch(start: URL): Promise<Response | null> {
  let current = start;
  const signal = AbortSignal.timeout(8000);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current); // throws → caught by caller, returns empty
    const res = await fetch(current, {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FanCastBot/1.0; link preview)",
        Accept: "text/html",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      await res.body?.cancel().catch(() => {});
      current = new URL(loc, current); // validated at top of next iteration
      continue;
    }
    return res;
  }
  return null; // too many redirects
}

export async function unfurl(url: URL): Promise<Unfurled> {
  const empty: Unfurled = { title: null, description: null, image: null };
  try {
    const res = await safeFetch(url);
    if (!res || !res.ok || !res.body) return empty;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
    }
    await reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks).toString("utf8");

    const ogTitle = metaContent(html, "og:title");
    const docTitle = decodeEntities(
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "",
    );
    const title = ogTitle ?? (docTitle || null);
    const finalUrl = res.url || url.toString();

    return {
      title,
      description:
        metaContent(html, "og:description") ?? metaContent(html, "description"),
      image: resolveImageUrl(metaContent(html, "og:image"), finalUrl),
    };
  } catch {
    return empty; // unfurl failure (incl. SSRF block) isn't fatal
  }
}
