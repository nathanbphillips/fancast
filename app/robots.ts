import type { MetadataRoute } from "next";

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://arseradio.com";

/**
 * Crawl rules (front-end review item 23). Marketing + profiles + rooms are
 * indexable; the account/auth surfaces are not. Points crawlers at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/settings", "/welcome", "/auth/", "/host/new"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
