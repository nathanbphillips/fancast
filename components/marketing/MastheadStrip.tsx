/**
 * The programme's masthead strip: "Vol. I · No. N / today's date / Price
 * 10p-struck £0". Global chrome since founder 2026-09-22: it sits at the VERY
 * top of every page (above the sticky nav, replacing the early-access
 * announcement bar) and scrolls away naturally - the nav stays sticky, the
 * strip does not. The volume is static, the issue number is the week of the
 * season, the price gag is the point.
 */
export function MastheadStrip() {
  const now = new Date();
  // season runs Aug-May; the issue number is the week of the season
  const seasonStartYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const seasonStart = new Date(Date.UTC(seasonStartYear, 7, 1));
  const issue = Math.max(1, Math.ceil((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const today = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });

  return (
    <div className="border-t-[3px] border-t-primary border-b border-line bg-canvas">
      <div className="mx-auto flex max-w-[1260px] items-center justify-between gap-4 px-5 py-1.5 font-mono text-[13px] tracking-[0.06em] text-primary sm:px-10">
        <span className="whitespace-nowrap">Vol. I · No. {issue}</span>
        {/* rendered in a client tree now: the day can flip between server
            render and hydration across midnight - harmless, suppress */}
        <span suppressHydrationWarning className="hidden whitespace-nowrap sm:inline">
          {today}
        </span>
        <span className="whitespace-nowrap">
          Price <s className="opacity-55">10p</s>{" "}
          <strong className="font-semibold text-red">£0</strong>
        </span>
      </div>
    </div>
  );
}
