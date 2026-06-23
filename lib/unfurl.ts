import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { request as httpRequest } from "node:http";
import { brand } from "@/lib/brand";

/**
 * Server-side OG unfurl (FR-9.1). Fetches the page, extracts Open Graph
 * tags with a title fallback.
 *
 * SSRF defense (audit H-2): redirects are followed MANUALLY and every hop
 * is validated BEFORE the request fires; each hostname is DNS-resolved and
 * rejected if it maps to any private/reserved IP (defeats decimal/hex IP
 * literals and internal DNS names, not just dotted-quad/localhost). https/
 * http only, 8s timeout, 1.5MB read cap, max 4 redirect hops.
 *
 * DNS-rebinding hardening (audit 2026-06-23, M-A): the address validated by
 * `resolvePinned` is PINNED into the actual connection via the node http(s)
 * `lookup` option, so a short-TTL host cannot return a public IP to the
 * validator and a private IP to the fetch. SNI/cert validation still uses the
 * real hostname (`servername`), so https keeps working.
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
    // expand to 8 groups so embedded-IPv4 forms can't smuggle a private target
    // (audit 2026-06-23 re-review): the old regex only caught the DOTTED mapped
    // form, so hex-tail mapped (::ffff:7f00:1), IPv4-compatible (::7f00:1), and
    // NAT64 (64:ff9b::a9fe:a9fe) literals slipped through as "public".
    const g = v6Groups(ip);
    if (!g) return true; // unparseable IPv6 → treat as unsafe
    if (g.every((x) => x === 0)) return true; // :: unspecified
    if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1 loopback
    if ((g[0] & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
    if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
    // prefixes that embed an IPv4 in the low 32 bits → decode + check as v4
    const hi6Zero = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0;
    const isMapped = hi6Zero && g[5] === 0xffff; // ::ffff:0:0/96
    const isCompat = hi6Zero && g[5] === 0; // ::/96 (IPv4-compatible, deprecated)
    const isNat64 =
      g[0] === 0x0064 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0;
    if (isMapped || isCompat || isNat64) {
      const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
      return isPrivateV4(v4);
    }
    return false; // other global-unicast IPv6 = public
  }
  return true; // not a recognizable IP → treat as unsafe
}

/** Expand an IPv6 literal to its 8 16-bit groups, or null if unparseable.
 *  Handles "::" compression and a trailing dotted-quad (::ffff:1.2.3.4). */
function v6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone); // strip zone id
  // fold a trailing dotted IPv4 into two hex groups, in place
  let bad = false;
  s = s.replace(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/, (_m, a, b, c, d) => {
    const n = [a, b, c, d].map(Number);
    if (n.some((x) => x > 255)) {
      bad = true;
      return "";
    }
    return `${((n[0] << 8) | n[1]).toString(16)}:${((n[2] << 8) | n[3]).toString(16)}`;
  });
  if (bad) return null;
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  let groups: string[];
  if (halves.length === 2) {
    const tail = halves[1] ? halves[1].split(":") : [];
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...new Array(fill).fill("0"), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const nums = groups.map((h) => (h === "" ? NaN : parseInt(h, 16)));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;
  return nums;
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

/** Validate the URL is a public http(s) target AND return the single address
 *  to pin the connection to. Resolves DNS so a numeric/encoded host or an
 *  internal name that maps to a private IP is rejected; the returned address
 *  is what the fetch must connect to (no second, unvalidated resolution). */
async function resolvePinned(
  url: URL,
): Promise<{ address: string; family: number }> {
  if (!isFetchableUrl(url)) throw new Error("blocked: scheme/host");
  const host = url.hostname;
  const fam = isIP(host);
  if (fam) {
    // literal IP — check directly, pin verbatim
    if (isPrivateIp(host)) throw new Error("blocked: private IP literal");
    return { address: host, family: fam };
  }
  // resolve all addresses; reject if ANY is private (covers split-horizon)
  const addrs = await lookup(host, { all: true });
  if (addrs.length === 0) throw new Error("blocked: unresolvable host");
  for (const { address } of addrs) {
    if (isPrivateIp(address)) throw new Error("blocked: resolves to private IP");
  }
  return { address: addrs[0].address, family: addrs[0].family };
}

/** Throws if the URL is not a public http(s) target. Exported for tests. */
export async function assertPublicUrl(url: URL): Promise<void> {
  await resolvePinned(url);
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

type RawResult =
  | { kind: "redirect"; location: string }
  | { kind: "body"; status: number; body: Buffer };

/** One request to a pinned address. Streams at most MAX_BYTES then aborts.
 *  Returns a redirect target (3xx + Location) or the response body. */
function rawRequest(
  url: URL,
  pinned: { address: string; family: number },
  signal: AbortSignal,
): Promise<RawResult> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const requestFn = isHttps ? httpsRequest : httpRequest;
    const options: RequestOptions = {
      method: "GET",
      signal,
      // pin the validated address; SNI/cert still use the real hostname
      servername: isHttps ? url.hostname : undefined,
      lookup: (_hostname, opts, cb) => {
        // node's socket connect calls lookup with { all: true } and expects the
        // array form; fall back to the scalar (err, address, family) form. Either
        // way we return ONLY the pre-validated pinned address (no rebinding).
        const anyCb = cb as unknown as (
          e: Error | null,
          a: string | { address: string; family: number }[],
          f?: number,
        ) => void;
        if ((opts as { all?: boolean })?.all) {
          anyCb(null, [{ address: pinned.address, family: pinned.family }]);
        } else {
          anyCb(null, pinned.address, pinned.family);
        }
      },
      headers: {
        "User-Agent": `Mozilla/5.0 (compatible; ${brand.name}Bot/1.0; link preview)`,
        Accept: "text/html",
        // node http does not auto-decompress; ask for identity so we read text
        "Accept-Encoding": "identity",
      },
    };
    const req = requestFn(url, options, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const loc = res.headers.location;
        res.resume(); // drain & free the socket
        if (loc) resolve({ kind: "redirect", location: Array.isArray(loc) ? loc[0] : loc });
        else resolve({ kind: "body", status, body: Buffer.alloc(0) });
        return;
      }
      const chunks: Buffer[] = [];
      let received = 0;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve({ kind: "body", status, body: Buffer.concat(chunks) });
      };
      res.on("data", (c: Buffer) => {
        received += c.length;
        if (received <= MAX_BYTES) chunks.push(c);
        else res.destroy(); // stop reading past the cap → "close" settles
      });
      res.on("end", done);
      res.on("close", done);
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

/** Fetch following redirects manually, validating + pinning each hop first. */
async function safeFetch(start: URL): Promise<{ body: Buffer; url: string } | null> {
  let current = start;
  const signal = AbortSignal.timeout(8000);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const pinned = await resolvePinned(current); // throws on private → caller catches
    const res = await rawRequest(current, pinned, signal);
    if (res.kind === "redirect") {
      current = new URL(res.location, current); // validated at top of next iteration
      continue;
    }
    if (res.status < 200 || res.status >= 300) return null;
    return { body: res.body, url: current.toString() };
  }
  return null; // too many redirects
}

export async function unfurl(url: URL): Promise<Unfurled> {
  const empty: Unfurled = { title: null, description: null, image: null };
  try {
    const res = await safeFetch(url);
    if (!res) return empty;
    const html = res.body.toString("utf8");

    const ogTitle = metaContent(html, "og:title");
    const docTitle = decodeEntities(
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "",
    );
    const title = ogTitle ?? (docTitle || null);

    return {
      title,
      description:
        metaContent(html, "og:description") ?? metaContent(html, "description"),
      image: resolveImageUrl(metaContent(html, "og:image"), res.url),
    };
  } catch {
    return empty; // unfurl failure (incl. SSRF block) isn't fatal
  }
}
