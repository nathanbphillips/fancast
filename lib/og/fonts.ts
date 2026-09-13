import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Font data for the next/og social cards (Programme redesign). Satori needs
 * raw TTF bytes; these are the same Anton + Newsreader faces the site loads
 * from Google Fonts. Read once per process from assets/fonts (force-included
 * in the deployed bundles via next.config.ts outputFileTracingIncludes - the
 * same mechanism, and the same page-path key lesson, as ffmpeg-static).
 */
const dir = path.join(process.cwd(), "assets", "fonts");

let cached: Promise<{
  anton: Buffer;
  newsreader: Buffer;
  newsreaderItalic: Buffer;
}> | null = null;

export function ogFonts() {
  cached ??= Promise.all([
    readFile(path.join(dir, "Anton-Regular.ttf")),
    readFile(path.join(dir, "Newsreader-Regular.ttf")),
    readFile(path.join(dir, "Newsreader-Italic.ttf")),
  ]).then(([anton, newsreader, newsreaderItalic]) => ({
    anton,
    newsreader,
    newsreaderItalic,
  }));
  return cached;
}

/** the ImageResponse `fonts` option for both cards */
export async function ogFontOptions() {
  const f = await ogFonts();
  return [
    { name: "Anton", data: f.anton, weight: 400 as const, style: "normal" as const },
    { name: "Newsreader", data: f.newsreader, weight: 400 as const, style: "normal" as const },
    { name: "Newsreader", data: f.newsreaderItalic, weight: 400 as const, style: "italic" as const },
  ];
}

/** Programme palette for the cards (single light/paper identity - a share
 *  card is one image everywhere, and paper pops on dark social UIs). */
export const OG = {
  paper: "#F7F1E2",
  ink: "#1B1A15",
  red: "#A8241A",
} as const;
