import sharp from "sharp";
const svg = `<svg width="3000" height="3000" xmlns="http://www.w3.org/2000/svg">
  <rect width="3000" height="3000" fill="#08080a"/>
  <rect x="0" y="2050" width="3000" height="14" fill="#EF0107"/>
  <text x="150" y="1450" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="430" letter-spacing="8">
    <tspan fill="#EF0107">ARSE</tspan><tspan fill="#f7f5f0">RADIO</tspan>
  </text>
  <text x="150" y="1900" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="150" letter-spacing="30" fill="#f7f5f0">THE POST-GAME SHOW</text>
  <text x="150" y="2250" font-family="Arial, Helvetica, sans-serif" font-size="76" letter-spacing="4" fill="#a2a2ab">FAN COMMENTARY, RECORDED LIVE IN THE MATCHDAY ROOM</text>
</svg>`;
const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await sharp(buf).toFile("public/podcast-cover.png");
const meta = await sharp("public/podcast-cover.png").metadata();
console.log("cover:", meta.width, "x", meta.height, Math.round(buf.length / 1024) + "KB");
// verify the text actually rendered (not a blank box): sample pixel stats
const stats = await sharp("public/podcast-cover.png").stats();
console.log("nonblank:", stats.channels[0].max > 100 ? "text rendered" : "BLANK - no text support");
