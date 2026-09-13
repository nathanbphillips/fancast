/**
 * The programme's decorative masthead strip (Programme redesign, founder
 * 2026-09-12; date instead of season per founder 2026-09-13): "Vol. I · No. N
 * / today's date / Price 10p-struck £0". Pure chrome - the volume is static,
 * the issue number is the week of the season (a real programme numbers its
 * issues), the price gag is the point. Server-rendered; the page's
 * revalidate keeps the date fresh.
 */
export function MastheadStrip({ className = "" }: { className?: string }) {
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
    <div
      className={`flex items-center justify-between gap-4 border-t-[3px] border-t-primary border-b border-b-primary py-2 font-mono text-[13px] tracking-[0.06em] text-primary ${className}`}
    >
      <span className="whitespace-nowrap">
        Vol. I · No. {issue}
      </span>
      <span className="hidden whitespace-nowrap sm:inline">{today}</span>
      <span className="whitespace-nowrap">
        Price <s className="opacity-55">10p</s>{" "}
        <strong className="font-semibold text-red">£0</strong>
      </span>
    </div>
  );
}
