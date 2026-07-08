import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { brand } from "@/lib/brand";
import { THEME_COOKIE, themeInitScript, type ThemeChoice } from "@/lib/theme";
import "./globals.css";

// Matchday redesign type system: Schibsted Grotesk (display + body/UI — heavy
// weights 700-900 for headlines/scores/wordmark, 400-600 for text), JetBrains
// Mono (labels/eyebrows/meta + ALL tabular numbers: clocks, scores, counts).
// NEVER put Schibsted on tabular numbers — use font-mono there so figures don't
// drift on every tick. Both are variable fonts (weight axis omitted = full range).
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // gives NEXT_PUBLIC_APP_URL a real use (absolute OG/canonical URLs) instead of
  // being a dead-but-"required" var; undefined in dev when unset is fine
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : undefined,
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`,
  },
  description: brand.tagline,
  // social share cards (og:image auto-attached from app/opengraph-image.tsx)
  openGraph: {
    title: brand.name,
    description: brand.tagline,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description: brand.tagline,
  },
  // iOS "Add to Home Screen" uses apple-touch-icon (the manifest 192/512 are
  // ignored there); without this iOS falls back to a page screenshot
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // Single dark value: the app is dark by default regardless of OS scheme (see
  // the pre-paint theme script), so keying themeColor off prefers-color-scheme
  // framed the dark page with a beige status bar on light-OS phones. Matchday
  // redesign dark base is #08080a (keep the manifest in sync).
  themeColor: "#08080a",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Bake the signed-in user's account theme into the pre-paint script so it
  // applies before first paint (M-11). localStorage still wins inside the
  // script; this only fills in on devices with no explicit choice.
  const raw = (await cookies()).get(THEME_COOKIE)?.value;
  const accountPref: ThemeChoice | null =
    raw === "dark" || raw === "light" ? raw : null;

  // Organization JSON-LD (front-end review item 23). Describes the company/site,
  // never a broadcast of any match, keeping the compliance line clean.
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    description: brand.tagline,
    ...(process.env.NEXT_PUBLIC_APP_URL
      ? { url: process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "") }
      : {}),
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript(accountPref) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
        />
      </head>
      <body
        className={`${schibsted.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
