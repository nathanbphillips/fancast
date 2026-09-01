import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/server";
import { buildFeedXml, loadEpisodes } from "@/lib/podcast";

/**
 * The public podcast RSS feed (founder 2026-09-01). Spotify and the other
 * directories poll this URL; publishing an episode from the recordings page
 * makes it appear here immediately. Reading is open by design: an RSS feed's
 * whole job is to be fetched anonymously.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const service = createServiceClient();
  const { episodes, error } = await loadEpisodes(service);
  if (error) {
    // 503 + no-store: pollers retry and the CDN never caches the failure
    return new NextResponse("feed temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://arseradio.com").replace(/\/$/, "");
  const audioBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/podcast`;
  const xml = buildFeedXml({ siteUrl, audioBaseUrl, episodes });
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // directories poll on their own schedule; a short shared cache keeps
      // a polling storm off the function without delaying a publish much
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
