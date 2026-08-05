import { NextResponse, type NextRequest } from "next/server";
import { isFetchableUrl } from "@/lib/unfurl";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { brand } from "@/lib/brand";

/**
 * First-party proxy for chat/link preview thumbnails (moderation review
 * 2026-08-05). Link og:images used to load in every listener's browser via a
 * raw <img src> pointed at an arbitrary third-party host — letting whoever
 * posted the link harvest every present listener's IP + user-agent (a
 * tracking-pixel vector). Now the browser only ever hits THIS origin; the
 * server fetches the image, so the third-party host sees our IP, not the
 * listeners'. Reuses isFetchableUrl (the same SSRF guard the unfurl uses), and
 * refuses redirects, non-image content, and oversized bodies. Best-effort: any
 * failure is a 4xx/5xx with no body, and the client thumbnail just hides itself.
 */
export const runtime = "nodejs";

const MAX_BYTES = 5_000_000;

export async function GET(request: NextRequest) {
  if (!rateLimit(`linkimg:${clientIp(request)}`, 300, 60 * 1000)) {
    return new NextResponse(null, { status: 429 });
  }

  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse(null, { status: 400 });
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  // SSRF guard: same allowlist the unfurl uses (http/https only, no private/
  // loopback/link-local hosts)
  if (!isFetchableUrl(url)) return new NextResponse(null, { status: 400 });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        signal: ctrl.signal,
        // never follow a redirect — it could land on a private IP that
        // isFetchableUrl already screened the original URL against
        redirect: "manual",
        headers: {
          "user-agent": `${brand.shortName}Bot/1.0`,
          accept: "image/*",
        },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300) return new NextResponse(null, { status: 502 });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return new NextResponse(null, { status: 415 });
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) return new NextResponse(null, { status: 413 });

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return new NextResponse(null, { status: 413 });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "content-type": contentType,
        // preview images are immutable per URL; cache hard so re-renders and
        // reconnects don't re-proxy
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
