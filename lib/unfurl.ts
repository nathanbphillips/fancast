/**
 * Server-side OG unfurl (FR-9.1). Fetches the page, extracts Open Graph
 * tags with a title fallback. Guards: https/http only, no raw-IP or
 * localhost hosts (SSRF), 5s timeout, 512KB read cap.
 */

export type Unfurled = {
  title: string | null;
  description: string | null;
  image: string | null;
};

const MAX_BYTES = 512 * 1024;

export function isFetchableUrl(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return false;
  // raw IPv4/IPv6 hosts — keeps the unfurler off internal networks
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes(":")) return false;
  return true;
}

function metaContent(html: string, property: string): string | null {
  // property/name in either attribute order
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

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

export async function unfurl(url: URL): Promise<Unfurled> {
  const empty: Unfurled = { title: null, description: null, image: null };
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
      headers: {
        // some sites only serve OG tags to identifiable agents
        "User-Agent": "Mozilla/5.0 (compatible; FanCastBot/1.0; link preview)",
        Accept: "text/html",
      },
    });
    if (!res.ok || !res.body) return empty;

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

    return {
      title,
      description: metaContent(html, "og:description"),
      image: metaContent(html, "og:image"),
    };
  } catch {
    return empty; // unfurl failure isn't fatal — card renders with the domain
  }
}
