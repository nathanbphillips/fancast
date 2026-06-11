/** Temp helper: fire a lifecycle action as kev using the captured cookie.
 *  Usage: tsx scripts/p4-trigger.ts <start|end> <roomId> */
import { readFileSync } from "node:fs";

const [action, roomId] = process.argv.slice(2);
const raw = readFileSync(`${process.env.TEMP}/p4ui.txt`, "utf16le");
const line = raw.split(/\r?\n/).find((l) => l.startsWith("KEV_COOKIE="));
const kev = line!.replace(/^KEV_COOKIE=/, "").trim();

fetch("http://localhost:3000/api/rooms", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: kev },
  body: JSON.stringify({ action, roomId }),
}).then(async (r) => {
  const body = await r.json().catch(() => ({}));
  console.log(r.status, body.room?.state ?? body.error, new Date().toISOString());
});
