/** Unit tests for the load-bearing attendance copy (lib/strings/attendance.ts).
 *  Run: npm run test:attendance */
import assert from "node:assert/strict";
import { attendanceLine, listeningLine, goingLine } from "../lib/strings/attendance";

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}: ${(e as Error).message}`);
  }
}

// zero and singular/plural base cases
test("0 RSVPs shows no line", () => {
  assert.equal(attendanceLine(0), null);
  assert.equal(attendanceLine(0, ["Sarah"]), null);
});
test("1 RSVP is singular", () => {
  assert.equal(attendanceLine(1), "1 person planning to attend");
});
test("N RSVPs are plural", () => {
  assert.equal(attendanceLine(2), "2 people planning to attend");
  assert.equal(attendanceLine(42), "42 people planning to attend");
});

// friend "including" variants (not the all-friends special case)
test("1 friend among many", () => {
  assert.equal(
    attendanceLine(10, ["Sarah"]),
    "10 people planning to attend, including Sarah",
  );
});
test("2 friends among many", () => {
  assert.equal(
    attendanceLine(10, ["Sarah", "Dave"]),
    "10 people planning to attend, including Sarah and Dave",
  );
});
test("3+ friends among many summarize the rest", () => {
  assert.equal(
    attendanceLine(20, ["Sarah", "Dave", "Ann"]),
    "20 people planning to attend, including Sarah and 2 friends",
  );
});

// all-friends-and-nobody-else special case (N == k+1 <= 3)
test("all friends, one friend + viewer", () => {
  assert.equal(attendanceLine(2, ["Sarah"]), "Sarah is planning to attend");
});
test("all friends, two friends + viewer", () => {
  assert.equal(
    attendanceLine(3, ["Sarah", "Dave"]),
    "Sarah and Dave are planning to attend",
  );
});
test("just over the special-case size falls back to including", () => {
  // N == k+1 but N > 3
  assert.equal(
    attendanceLine(4, ["Sarah", "Dave", "Ann"]),
    "4 people planning to attend, including Sarah and 2 friends",
  );
});

// live line
test("live listening line", () => {
  assert.equal(listeningLine(0), "0 listening now");
  assert.equal(listeningLine(37), "37 listening now");
});

// terse "going" line for compact cards
test("going line: zero shows nothing, N is terse + grouped", () => {
  assert.equal(goingLine(0), null);
  assert.equal(goingLine(-3), null);
  assert.equal(goingLine(1), "1 going");
  assert.equal(goingLine(1240), "1,240 going");
});

// THE load-bearing rule: never attach "attend" to the match
test("attend never attaches to the match", () => {
  const samples = [
    attendanceLine(1),
    attendanceLine(5),
    attendanceLine(3, ["Sarah", "Dave"]),
    attendanceLine(10, ["Sarah"]),
    listeningLine(9),
  ].filter(Boolean) as string[];
  for (const s of samples) {
    assert.ok(
      !/attend (the|this) match/i.test(s),
      `forbidden copy in: "${s}"`,
    );
    assert.ok(!s.includes("—"), `em-dash in: "${s}"`);
  }
});

console.log(failures === 0 ? "\nALL ATTENDANCE TESTS PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
