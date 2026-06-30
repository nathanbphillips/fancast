import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { brand } from "@/lib/brand";
import { THEME_COOKIE, themeInitScript, type ThemeChoice } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Display face for headings/wordmark/labels (the redesign's bold geometric
// grotesque). Body stays Inter; never apply this to tabular-nums elements.
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
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
  // iOS "Add to Home Screen" uses apple-touch-icon (the manifest 192/512 are
  // ignored there); without this iOS falls back to a page screenshot
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0f14" },
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
  ],
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript(accountPref) }}
        />
      </head>
      <body
        className={`${inter.variable} ${display.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
