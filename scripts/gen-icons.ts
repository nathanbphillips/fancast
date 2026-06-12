/** One-off: render the app icon SVG to the PNG sizes the PWA needs. */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// brand-neutral mark: broadcast waves in gold over the dark canvas with a
// red live dot — no club marks (DESIGN.md), no hardcoded wordmark
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0D0F14"/>
  <circle cx="256" cy="300" r="34" fill="#EF0107"/>
  <g stroke="#C9A864" stroke-width="26" fill="none" stroke-linecap="round">
    <path d="M 168 252 A 100 100 0 0 1 344 252"/>
    <path d="M 122 196 A 170 170 0 0 1 390 196"/>
    <path d="M 76 140 A 240 240 0 0 1 436 140"/>
  </g>
</svg>`;

async function main() {
  const dir = join(process.cwd(), "public", "icons");
  mkdirSync(dir, { recursive: true });
  const src = Buffer.from(SVG);
  await sharp(src).resize(192, 192).png().toFile(join(dir, "icon-192.png"));
  await sharp(src).resize(512, 512).png().toFile(join(dir, "icon-512.png"));
  await sharp(src).resize(180, 180).png().toFile(join(dir, "apple-touch-icon.png"));
  console.log("icons written to public/icons");
}

main();
