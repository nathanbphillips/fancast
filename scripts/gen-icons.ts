/** One-off: render the app icon SVG to the PNG sizes the PWA needs. */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// brand-neutral mark (Programme redesign 2026-09-12): broadcast waves in ink
// on the paper field with the deep-red lamp - no club marks (DESIGN.md), no
// hardcoded wordmark. The rx stays: an icon is an OS asset, not a page corner.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#F7F1E2"/>
  <rect x="56" y="56" width="400" height="14" fill="#1B1A15"/>
  <circle cx="256" cy="312" r="36" fill="#A8241A"/>
  <g stroke="#1B1A15" stroke-width="26" fill="none" stroke-linecap="round">
    <path d="M 168 264 A 100 100 0 0 1 344 264"/>
    <path d="M 122 208 A 170 170 0 0 1 390 208"/>
    <path d="M 76 152 A 240 240 0 0 1 436 152"/>
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
