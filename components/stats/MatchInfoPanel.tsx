import type { MatchInfo } from "@/lib/stats";

/**
 * Info tab (pre-game): venue, referee, weather, and team news (sidelined
 * players), distilled server-side in lib/stats. Default tab before kickoff;
 * the room auto-switches everyone to Stats at kickoff.
 */
export function MatchInfoPanel({
  info,
  homeName,
  awayName,
  size = "compact",
}: {
  info: MatchInfo | null;
  homeName: string;
  awayName: string;
  size?: "compact" | "radio";
}) {
  const big = size === "radio";
  const text = big ? "text-sm" : "text-[13px]";

  if (!info) {
    return (
      <p className={`text-secondary ${big ? "text-base" : "text-sm"}`}>
        Match info — venue, referee, weather, and team news — appears closer to kickoff.
      </p>
    );
  }

  const Fact = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`shrink-0 text-secondary ${big ? "text-sm" : "text-xs"}`}>{label}</span>
      <span className={`text-right ${text}`}>
        <span className="font-semibold">{value}</span>
        {sub && <span className="block text-[11px] text-secondary">{sub}</span>}
      </span>
    </div>
  );

  const w = info.weather;
  const weatherSub = w
    ? [
        w.temp != null ? `${Math.round(w.temp)}°C` : null,
        w.humidity ? `${w.humidity} humidity` : null,
        w.wind != null ? `wind ${Math.round(w.wind)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const NewsCol = ({ name, rows }: { name: string; rows: { name: string; reason: string }[] }) => (
    <div className="min-w-0">
      <p className={`mb-1 font-semibold ${big ? "text-sm" : "text-xs"}`}>{name}</p>
      {rows.length === 0 ? (
        <p className="text-[11px] text-secondary">No reported absences.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className={text}>
              <span className="truncate">{r.name}</span>
              <span className="block text-[11px] text-secondary">{r.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const hasNews = info.teamNews.home.length > 0 || info.teamNews.away.length > 0;

  return (
    <div className="space-y-3">
      {(info.venue || info.referee || w) && (
        <div className="space-y-2 rounded-xl border-[0.75px] border-line bg-surface p-3">
          {info.venue && (
            <Fact
              label="Venue"
              value={info.venue.city ? `${info.venue.name}, ${info.venue.city}` : info.venue.name}
              sub={info.venue.capacity ? `${info.venue.capacity.toLocaleString()} capacity` : undefined}
            />
          )}
          {info.referee && <Fact label="Referee" value={info.referee} />}
          {w && <Fact label="Weather" value={w.description} sub={weatherSub || undefined} />}
        </div>
      )}

      {hasNews && (
        <div className="rounded-xl border-[0.75px] border-line bg-surface p-3">
          <p className={`mb-2 font-semibold text-secondary ${big ? "text-xs" : "text-[11px]"}`}>
            Team news
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NewsCol name={homeName} rows={info.teamNews.home} />
            <NewsCol name={awayName} rows={info.teamNews.away} />
          </div>
        </div>
      )}
    </div>
  );
}
