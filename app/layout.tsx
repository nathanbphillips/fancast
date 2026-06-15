import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { brand } from "@/lib/brand";
import { THEME_COOKIE, themeInitScript, type ThemeChoice } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`,
  },
  description: brand.tagline,
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
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
