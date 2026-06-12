/** Unit tests for the pure clock derivation (lib/clock.ts) — the one
 *  piece of logic the whole room display hangs off. Run: npm run test:clock */
import assert from "node:assert/strict";
import { deriveClock, formatClock, type ClockEventInput } from "../lib/clock";

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

const T0 = Date.parse("2026-08-15T16:30:00Z");
const iso = (offsetSec: number) => new Date(T0 + offsetSec * 1000).toISOString();
const ev = (
  action: ClockEventInput["action"],
  atSec: number,
  offset = 0,
): ClockEventInput => ({
  action,
  server_ts: iso(atSec),
  offset_seconds: offset,
});

test("no events -> not running", () => {
  assert.deepEqual(deriveClock([], T0), { running: false });
});

test("first half runs from 0:00", () => {
  const d = deriveClock([ev("start1h", 0)], T0 + 10_000);
  assert.deepEqual(d, { running: true, period: "1H", elapsedSeconds: 10 });
});

test("first half counts past 45:00 freely", () => {
  const d = deriveClock([ev("start1h", 0)], T0 + 47 * 60 * 1000);
  assert.equal(d.running && d.elapsedSeconds, 47 * 60);
});

test("halftime stops the clock entirely (state word territory)", () => {
  const d = deriveClock([ev("start1h", 0), ev("stop1h", 46 * 60)], T0 + 50 * 60 * 1000);
  assert.deepEqual(d, { running: false });
});

test("second half starts at 45:00 regardless of wall time", () => {
  const events = [ev("start1h", 0), ev("stop1h", 46 * 60), ev("start2h", 62 * 60)];
  const d = deriveClock(events, T0 + (62 * 60 + 30) * 1000);
  assert.deepEqual(d, { running: true, period: "2H", elapsedSeconds: 45 * 60 + 30 });
});

test("second half counts past 90:00 (78:40 style display)", () => {
  const events = [ev("start1h", 0), ev("stop1h", 46 * 60), ev("start2h", 62 * 60)];
  const d = deriveClock(events, T0 + (62 * 60 + 48 * 60) * 1000);
  assert.equal(d.running && formatClock(d.elapsedSeconds), "93:00");
});

test("extra time starts at 90:00", () => {
  const events = [
    ev("start1h", 0),
    ev("stop1h", 46 * 60),
    ev("start2h", 62 * 60),
    ev("stop2h", 110 * 60),
    ev("start_et", 115 * 60),
  ];
  const d = deriveClock(events, T0 + (115 * 60 + 14 * 60 + 12) * 1000);
  assert.equal(d.running && d.period, "ET");
  assert.equal(d.running && formatClock(d.elapsedSeconds), "104:12");
});

test("adjustments shift the running clock", () => {
  const events = [ev("start1h", 0), ev("adjust", 10, 2), ev("adjust", 20, -1)];
  const d = deriveClock(events, T0 + 30_000);
  assert.equal(d.running && d.elapsedSeconds, 31); // 30 + 2 - 1
});

test("adjustments reset at the next period start", () => {
  const events = [
    ev("start1h", 0),
    ev("adjust", 10, 5),
    ev("stop1h", 46 * 60),
    ev("start2h", 62 * 60),
  ];
  const d = deriveClock(events, T0 + (62 * 60 + 10) * 1000);
  assert.equal(d.running && d.elapsedSeconds, 45 * 60 + 10); // no stale +5
});

test("adjust while stopped is ignored", () => {
  const events = [ev("start1h", 0), ev("stop1h", 45 * 60), ev("adjust", 46 * 60, 9)];
  assert.deepEqual(deriveClock(events, T0 + 47 * 60 * 1000), { running: false });
});

test("out-of-order event delivery is sorted by server time", () => {
  const events = [ev("start2h", 62 * 60), ev("stop1h", 46 * 60), ev("start1h", 0)];
  const d = deriveClock(events, T0 + (62 * 60 + 5) * 1000);
  assert.deepEqual(d, { running: true, period: "2H", elapsedSeconds: 45 * 60 + 5 });
});

test("clock never goes negative on skewed clocks", () => {
  const d = deriveClock([ev("start1h", 10)], T0 + 5_000); // local clock behind server
  assert.equal(d.running && d.elapsedSeconds, 0);
});

test("reconnect mid-half lands on the same time (replay = same answer)", () => {
  const events = [ev("start1h", 0), ev("adjust", 100, 3)];
  const a = deriveClock(events, T0 + 1_000_000);
  const b = deriveClock([...events].reverse(), T0 + 1_000_000);
  assert.deepEqual(a, b);
});

test("formatClock pads seconds", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(65), "1:05");
  assert.equal(formatClock(45 * 60), "45:00");
  assert.equal(formatClock(78 * 60 + 40), "78:40");
});

console.log(failures === 0 ? "\nALL CLOCK TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
