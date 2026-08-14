/**
 * Unit test for the recording-integrity verdict (npm run test:integrity).
 *
 * The cases are taken from real measurements of the 2026-08-05 recordings, so
 * a regression here is a regression against broadcasts we actually lost.
 */
import { integrityProblem } from "@/lib/recording";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

// --- the Betis broadcast: 2h36m show, 11 min captured, ~100s of it audible ---
const betis = integrityProblem({ seconds: 673, audible: 28, meanDb: -43.1 }, 9384);
check("Betis (11 min of a 156 min show) is flagged", betis !== null, betis ?? "");
check(
  "the Betis reason names the shortfall, not the silence",
  !!betis && betis.includes("stopped early"),
  betis ?? "",
);

// --- a healthy short show: 7 min captured of a 7 min broadcast ---
check(
  "a healthy 7 min recording passes",
  integrityProblem({ seconds: 424, audible: 360, meanDb: -26 }, 430) === null,
);

// --- a healthy long show ---
check(
  "a healthy 2h recording passes",
  integrityProblem({ seconds: 7180, audible: 5200, meanDb: -24 }, 7200) === null,
);

// --- full length but digital silence: the other way this breaks ---
const silent = integrityProblem({ seconds: 7180, audible: 0, meanDb: -91 }, 7200);
check("a full-length but silent recording is flagged", silent !== null, silent ?? "");
check("the silent reason says silent", !!silent && silent.includes("silent"), silent ?? "");

// --- full length, not digitally silent, but essentially no speech ---
const noSpeech = integrityProblem({ seconds: 10799, audible: 108, meanDb: -55 }, 10800);
check("a recording with almost no audible content is flagged", noSpeech !== null, noSpeech ?? "");

// --- boundaries: do not cry wolf ---
check(
  "a short test broadcast is not judged on length",
  integrityProblem({ seconds: 40, audible: 30, meanDb: -25 }, 90) === null,
  "expected < 120s, so the length rule must not apply",
);
check(
  "normal marker jitter does not trip the length rule",
  integrityProblem({ seconds: 3500, audible: 3000, meanDb: -25 }, 3600) === null,
);
check(
  "a quiet but real recording is not called silent",
  integrityProblem({ seconds: 3600, audible: 1800, meanDb: -45 }, 3600) === null,
  "-45 dB is quiet, not empty",
);
check(
  "missing volume data does not flag on its own",
  integrityProblem({ seconds: 3600, audible: 3000, meanDb: null }, 3600) === null,
);
// exactly half is the documented cutoff; just above it must pass
check(
  "just above the 50% cutoff passes",
  integrityProblem({ seconds: 3700, audible: 3000, meanDb: -25 }, 7200) === null,
);
check(
  "just below the 50% cutoff is flagged",
  integrityProblem({ seconds: 3500, audible: 3000, meanDb: -25 }, 7200) !== null,
);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
