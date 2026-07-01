import type { Metadata } from "next";
import { loadFixtures } from "@/lib/db/fixtures";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { MatchesBrowser } from "@/components/marketing/MatchesBrowser";

/**
 * Matches: the full live + upcoming schedule (FR-1), Cloud Design. A DB failure
 * throws to the (app) error boundary rather than reading as an empty schedule.
 */

export const metadata: Metadata = { title: "Matches" };
export const revalidate = 60;

export default async function MatchesPage() {
  const { live, upcoming } = await loadFixtures();

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-10">
      <Eyebrow>Full schedule · Arsenal</Eyebrow>
      <h1 className="display mt-3 text-6xl sm:text-7xl">Matches</h1>
      <p className="mt-4 max-w-xl text-secondary">
        Every Arsenal match, live and upcoming. Jump into a room when the host
        opens the doors.
      </p>

      <MatchesBrowser live={live} upcoming={upcoming} />

      <div className="mt-14 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="display text-2xl">Want to host a room?</h2>
          <p className="mt-1 text-sm text-secondary">
            Got the voice and the knowledge? Bring the matchday to life for the
            rest of us.
          </p>
        </div>
        <Button href="/about" variant="red">
          Read more →
        </Button>
      </div>
    </div>
  );
}
