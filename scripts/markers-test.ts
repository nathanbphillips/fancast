/** Unit tests for segment derivation (lib/markers.ts) — the logic that
 *  turns markers into the cut list. Pure, no native deps. npm run test:markers */
import assert from "node:assert/strict";
import { deriveSegments, type Marker } from "../lib/markers";

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name} — ${(e as Error).message}`);
  }
}

const T0 = Date.parse("2026-08-15T16:00:00Z");
const m = (kind: Marker["kind"], atSec: number, adjustSec?: number): Pick<Marker, "kind" | "label" | "server_ts" | "adjusted_ts"> => ({
  kind,
  label: kind,
  server_ts: new Date(T0 + atSec * 1000).toISOString(),
  adjusted_ts: adjustSec === undefined ? null : new Date(T0 + adjustSec * 1000).toISOString(),
});

test("standard full match with extra time → six clean segments", () => {
  const markers = [
    m("broadcast_start", 0),
    m("start_1h", 8),
    m("stop_1h", 14),
    m("start_2h", 19),
    m("stop_2h", 33),
    m("start_et", 33.4), // prompt ET → tiny post-game sliver dropped
    m("stop_et", 39),
    m("broadcast_end", 43),
  ];
  const segs = deriveSegments(markers, T0, T0 + 43_000);
  assert.deepEqual(
    segs.map((s) => s.label),
    ["Pre-game show", "First half", "Halftime show", "Second half", "Extra time", "Post-game show"],
  );
  // contiguous, monotonically increasing
  assert.equal(segs[0].startOffset, 0);
  for (let i = 1; i < segs.length; i++) {
    assert.ok(segs[i].startOffset >= segs[i - 1].startOffset);
  }
});

test("no extra time → five segments ending in post-game", () => {
  const markers = [
    m("broadcast_start", 0),
    m("start_1h", 5),
    m("stop_1h", 50),
    m("start_2h", 65),
    m("stop_2h", 110),
    m("broadcast_end", 130),
  ];
  const segs = deriveSegments(markers, T0, T0 + 130_000);
  assert.deepEqual(
    segs.map((s) => s.label),
    ["Pre-game show", "First half", "Halftime show", "Second half", "Post-game show"],
  );
});

test("first-half boundary respects a ±2min adjustment", () => {
  const markers = [
    m("broadcast_start", 0),
    m("start_1h", 10),
    m("stop_1h", 60, 45), // halftime starts 15s earlier than live
    m("start_2h", 75),
    m("stop_2h", 120),
    m("broadcast_end", 140),
  ];
  const segs = deriveSegments(markers, T0, T0 + 140_000);
  const first = segs.find((s) => s.label === "First half")!;
  const half = segs.find((s) => s.label === "Halftime show")!;
  assert.equal(first.endOffset, 45); // adjusted, not 60
  assert.equal(half.startOffset, 45);
});

test("sub-2s slivers are dropped", () => {
  const markers = [
    m("broadcast_start", 0),
    m("start_1h", 10),
    m("stop_1h", 10.5), // 0.5s 'first half' → dropped
    m("start_2h", 20),
    m("stop_2h", 60),
    m("broadcast_end", 70),
  ];
  const segs = deriveSegments(markers, T0, T0 + 70_000);
  assert.ok(!segs.some((s) => s.label === "First half"));
});

test("idx is contiguous after drops/merges", () => {
  const markers = [
    m("broadcast_start", 0),
    m("start_1h", 8),
    m("stop_1h", 14),
    m("start_2h", 19),
    m("stop_2h", 33),
    m("start_et", 33.2),
    m("stop_et", 39),
    m("broadcast_end", 43),
  ];
  const segs = deriveSegments(markers, T0, T0 + 43_000);
  segs.forEach((s, i) => assert.equal(s.idx, i + 1));
});

console.log(failures === 0 ? "\nALL MARKER TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
