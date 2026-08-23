/**
 * Unit test for recording pause/resume math (npm run test:pauses).
 * Pauses exclude spans from the produced files; markers inside a pause and
 * unpaired pauses must behave predictably.
 */
import {
  deriveSegments,
  instantPaused,
  parseSegmentPlaylist,
  pauseIntervals,
  pausedTotal,
  segmentPaused,
} from "@/lib/markers";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " - " + detail : ""}`);
  if (!ok) failures++;
};
const T0 = Date.parse("2026-08-22T19:00:00Z");
const ts = (s: number) => new Date(T0 + s * 1000).toISOString();
const END = T0 + 3600 * 1000;

// one clean pause
let iv = pauseIntervals(
  [{ kind: "record_pause", server_ts: ts(600) }, { kind: "record_resume", server_ts: ts(900) }],
  T0, END,
);
check("one pause -> one interval", iv.length === 1 && iv[0][0] === 600 && iv[0][1] === 900, JSON.stringify(iv));
check("paused total", pausedTotal(iv) === 300);
check("segment inside pause is excluded", segmentPaused(700, iv));
check("segment at pause start is excluded", segmentPaused(600, iv));
check("segment just before pause kept", !segmentPaused(599, iv));
check("segment at resume second is kept", !segmentPaused(900, iv));

// open pause closes at recording end
iv = pauseIntervals([{ kind: "record_pause", server_ts: ts(3000) }], T0, END);
check("open pause runs to end", iv.length === 1 && iv[0][1] === 3600, JSON.stringify(iv));

// stray resume + double pause are ignored
iv = pauseIntervals(
  [
    { kind: "record_resume", server_ts: ts(10) },
    { kind: "record_pause", server_ts: ts(100) },
    { kind: "record_pause", server_ts: ts(120) },
    { kind: "record_resume", server_ts: ts(200) },
  ],
  T0, END,
);
check("stray resume ignored, double pause pairs once", iv.length === 1 && iv[0][0] === 100 && iv[0][1] === 200, JSON.stringify(iv));

// multiple pauses, unsorted input
iv = pauseIntervals(
  [
    { kind: "record_resume", server_ts: ts(1500) },
    { kind: "record_pause", server_ts: ts(1200) },
    { kind: "record_pause", server_ts: ts(300) },
    { kind: "record_resume", server_ts: ts(400) },
  ],
  T0, END,
);
check("two pauses from unsorted markers", iv.length === 2 && pausedTotal(iv) === 400, JSON.stringify(iv));

// pause markers never become segment boundaries
const segs = deriveSegments(
  [
    { kind: "broadcast_start", label: "Pre-game show", server_ts: ts(0), adjusted_ts: null },
    { kind: "record_pause", label: "Recording paused", server_ts: ts(300), adjusted_ts: null },
    { kind: "record_resume", label: "Recording resumed", server_ts: ts(420), adjusted_ts: null },
    { kind: "start_1h", label: "First half", server_ts: ts(1800), adjusted_ts: null },
    { kind: "broadcast_end", label: "Segment", server_ts: ts(3600), adjusted_ts: null },
  ],
  T0, END,
);
check("pauses do not split segments", segs.length === 2 && segs[0].label === "Pre-game show" && segs[1].label === "First half", segs.map((s) => s.label).join("|"));

// the founder's case: pause right at a boundary -> that file starts at resume
// (the exclusion is applied by the caller via segmentPaused; here we prove the
// boundary itself is unaffected and the excluded seconds are exactly the span)
const excluded = [];
for (let i = 1790; i < 1830; i++) if (segmentPaused(i, pauseIntervals([
  { kind: "record_pause", server_ts: ts(1800) }, { kind: "record_resume", server_ts: ts(1810) },
], T0, END))) excluded.push(i);
check("pause at a boundary drops exactly those 10 seconds", excluded.length === 10 && excluded[0] === 1800 && excluded[9] === 1809, excluded.join(","));

// Playlist timing (review 2026-08-23): a "1s" segment is 0.998s of audio, so
// after an hour segment 3600 starts ~5.5s before wall second 3600. The
// playlist's EXT-X-PROGRAM-DATE-TIME is what decides whether a segment sits in
// a pause, never its index.
const SEG = 0.998458;
const lines = ["#EXTM3U", "#EXT-X-VERSION:4", "#EXT-X-TARGETDURATION:1", "#EXT-X-MEDIA-SEQUENCE:0"];
const EGRESS_START = T0 + 2500; // egress boots 2.5s after started_at
for (let i = 0; i < 4000; i++) {
  lines.push("#EXT-X-PROGRAM-DATE-TIME:" + new Date(EGRESS_START + i * SEG * 1000).toISOString());
  lines.push("#EXTINF:0.998,");
  lines.push("seg_" + String(i).padStart(5, "0") + ".ts");
}
lines.push("#EXT-X-ENDLIST");
const tl = parseSegmentPlaylist(lines.join("\n"));
check("playlist parses every segment", tl.length === 4000, String(tl.length));
check("playlist keeps index + start + duration", tl[7].idx === 7 && tl[7].startMs === EGRESS_START + Math.round(7 * SEG * 1000) && tl[7].durS === 0.998, JSON.stringify(tl[7]));
check("playlist without date tags yields nothing", parseSegmentPlaylist("#EXTM3U\n#EXTINF:1,\nseg_00000.ts\n").length === 0);

// a 60s pause an hour in: which segments fall inside by PLAYLIST time vs index
const late = pauseIntervals(
  [{ kind: "record_pause", server_ts: ts(3600) }, { kind: "record_resume", server_ts: ts(3660) }],
  T0, T0 + 7200 * 1000, // a two-hour show (END above is one hour)
);
const byTime = tl.filter((e) => instantPaused((e.startMs - T0) / 1000 + e.durS / 2, late)).map((e) => e.idx);
const byIndex = tl.filter((e) => segmentPaused(e.idx, late)).map((e) => e.idx);
check("60s pause excludes ~60 segments by playlist time", byTime.length >= 59 && byTime.length <= 61, String(byTime.length));
// wall 3600 is 3597.5s after the egress start, at 0.998458s per segment that is segment ~3603
check("first excluded segment lands by clock, not by index", byTime[0] === 3603, "first=" + byTime[0] + " (index-based would be " + byIndex[0] + ")");
check("index arithmetic really does drift (the bug being prevented)", byIndex[0] === 3600 && byTime[0] - byIndex[0] >= 3, "drift " + (byTime[0] - byIndex[0]) + " segments at 1h");

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
