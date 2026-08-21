/** Two questions: does 1s segmentation actually happen, and does the CDN
 *  serve players (no cache-buster) a stale playlist? */
import "dotenv/config";
const ROOM = "cea622f8-d418-418f-ae9f-bf8d840e010c";
const URL_ = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/radio/${ROOM}/live.m3u8`;
async function sample(label: string, bust: boolean) {
  const rows: string[] = [];
  let prev = -1;
  for (let i = 0; i < 4; i++) {
    const u = bust ? `${URL_}?cb=${Date.now()}` : URL_;
    const res = await fetch(u, { cache: "no-store" });
    const text = await res.text();
    const seq = Number(text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/)?.[1] ?? -1);
    const durs = [...text.matchAll(/#EXTINF:([\d.]+)/g)].map((m) => Number(m[1]).toFixed(1));
    const age = res.headers.get("age");
    const cache = res.headers.get("cache-control");
    const cdn = res.headers.get("cf-cache-status") ?? res.headers.get("x-cache") ?? "-";
    rows.push(`  t+${i * 3}s seq=${seq}${prev >= 0 ? ` (+${seq - prev})` : ""} durs=[${durs.join(",")}] age=${age ?? "-"} cdn=${cdn} cc=${(cache ?? "").slice(0, 40)}`);
    prev = seq;
    if (i < 3) await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(`=== ${label} ===`); rows.forEach((r) => console.log(r));
}
async function main() {
  await sample("WITH cache-buster (what my earlier measurement did)", true);
  await sample("WITHOUT cache-buster (what a real player does)", false);
}
main().catch((e) => { console.error(e); process.exit(1); });
