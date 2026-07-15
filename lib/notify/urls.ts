/** Absolute site URL for links in emails / push (no trailing slash). */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "https://arseradio.com";
}

export function roomUrl(slug: string): string {
  return `${siteUrl()}/room/${slug}`;
}
