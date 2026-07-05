import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/db/server";

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://fancast-26.vercel.app";

/**
 * Sitemap (front-end review item 23): the static marketing routes plus every
 * live/scheduled room by its canonical slug. A DB hiccup degrades to the static
 * routes rather than failing the sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", priority: 1 },
    { path: "/matches", priority: 0.9 },
    { path: "/how-it-works", priority: 0.7 },
    { path: "/host", priority: 0.7 },
    { path: "/about", priority: 0.6 },
    { path: "/signin", priority: 0.4 },
    { path: "/guidelines", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
    { path: "/privacy", priority: 0.3 },
  ].map((r) => ({
    url: `${base}${r.path}`,
    changeFrequency: "weekly" as const,
    priority: r.priority,
  }));

  let roomRoutes: MetadataRoute.Sitemap = [];
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("rooms")
      .select("slug, state")
      .not("slug", "is", null)
      .not("state", "in", "(canceled,wrapped)")
      .limit(2000);
    const seen = new Set<string>();
    for (const r of (data ?? []) as { slug: string | null }[]) {
      if (!r.slug || seen.has(r.slug)) continue;
      seen.add(r.slug);
      roomRoutes.push({
        url: `${base}/room/${r.slug}`,
        changeFrequency: "hourly" as const,
        priority: 0.6,
      });
    }
  } catch {
    // schedule unavailable: ship the static routes only
  }

  return [...staticRoutes, ...roomRoutes];
}
