import type { Metadata } from "next";
import { loadFixtures } from "@/lib/db/fixtures";
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
    <>
      {/* HEADER */}
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(110% 100% at 85% -20%, rgba(241,35,43,0.16), transparent 56%), var(--bg-base)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--hair) / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--hair) / 0.04) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            maskImage:
              "radial-gradient(120% 100% at 80% 0%, black, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(120% 100% at 80% 0%, black, transparent 75%)",
          }}
        />
        <div className="relative mx-auto max-w-[1180px] px-5 pt-14 pb-8 sm:px-10">
          <p className="mb-3.5 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
            Full schedule · Arsenal
          </p>
          <h1 className="display text-6xl leading-[0.9] sm:text-7xl">Matches</h1>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.5] text-secondary">
            Every Arsenal fixture with a room. Join the live show when the host
            opens the doors.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-10">
        <MatchesBrowser live={live} upcoming={upcoming} />

        {/* HOST CTA BAND */}
        <div className="mt-9 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface px-[26px] py-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-extrabold tracking-[-0.01em]">
              Want to host a room?
            </p>
            <p className="mt-1 text-[13.5px] text-secondary">
              Arsenal first. More clubs to come. If you fancy calling the match,
              there&apos;ll be room for you too.
            </p>
          </div>
          <Button href="/about" variant="red">
            Read more →
          </Button>
        </div>
      </div>
    </>
  );
}
