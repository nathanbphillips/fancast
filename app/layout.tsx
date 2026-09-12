import type { Metadata, Viewport } from "next";
import { Anton, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import { brand } from "@/lib/brand";
import { THEME_COOKIE, themeInitScript, type ThemeChoice } from "@/lib/theme";
import { ClientErrorReporter } from "@/components/ClientErrorReporter";
import "./globals.css";

// Matchday Programme type system (founder 2026-09-12): Anton 400 is the
// display face (masthead, section heads, scorelines - always uppercase via
// .display); Newsreader carries EVERYTHING else - body, italic captions, and
// the small-caps label + tabular-numeral treatment behind the font-mono
// utility (Newsreader's figures are tabular lining - verified, so clocks
// don't drift on ticks). Nothing renders above weight 600.
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
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
  // Single value: the app is PAPER by default regardless of OS scheme (see the
  // pre-paint theme script), so themeColor matches the Programme's cream page.
  // Keep the manifest in sync.
  themeColor: "#F7F1E2",
  // let the page paint under the notch / home-indicator so the room's bottom
  // tab bar's env(safe-area-inset-bottom) padding actually engages on notched
  // iPhones (founder 2026-08-05)
  viewportFit: "cover",
  // the on-screen keyboard resizes the layout viewport instead of overlaying it,
  // so h-dvh flex layouts (the room) reflow and the chat composer stays above
  // the keyboard on mobile (live-test review 2026-08-05)
  interactiveWidget: "resizes-content",
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
        className={`${anton.variable} ${newsreader.variable} font-sans antialiased`}
      >
        {children}
        <ClientErrorReporter />
      </body>
    </html>
  );
}
