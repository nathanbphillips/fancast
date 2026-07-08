import type { MatchInfo } from "@/lib/stats";

/**
 * Info tab (pre-game): team news (left) beside venue / referee / weather
 * (right) as two half-width cards once the stats column is wide enough
 * (container query), stacking on a narrow column. Larger, denser type than the
 * first redesign pass (founder 2026-07-02). Distilled server-side in lib/stats.
 */
export function MatchInfoPanel({
  info,
  homeName,
  awayName,
}: {
  info: MatchInfo | null;
  homeName: string;
  awayName: string;
}) {
  if (!info) {
    return (
      <p className="text-sm text-secondary">
        Match info — venue, referee, weather, and team news — appears closer to
        kickoff.
      </p>
    );
  }

  const cardTitle =
    "mb-3 font-mono text-[11px] font-bold tracking-[0.14em] text-secondary uppercase";

  const Fact = ({
    label,
    value,
    sub,
  }: {
    label: string;
    value: string;
    sub?: string;
  }) => (
    <div>
      <p className="text-[13px] text-secondary">{label}</p>
      <p className="text-[15px] font-semibold">{value}</p>
      {sub && <p className="text-xs text-secondary">{sub}</p>}
    </div>
  );

  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const w = info.weather;
  const weatherSub = w
    ? [
        w.temp != null ? `${Math.round(w.temp)}°C` : null,
        w.windMph != null ? `Wind ${w.windMph} mph` : null,
        w.humidity ? `Humidity ${w.humidity}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const RefereeBlock = ({ crew }: { crew: { role: string; name: string }[] }) => {
    const [head, ...rest] = crew;
    return (
      <div>
        <p className="text-[13px] text-secondary">{head.role || "Referee"}</p>
        <p className="text-[15px] font-semibold">{head.name}</p>
        {rest.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {rest.map((r, i) => (
              <li key={`${r.role}-${i}`} className="text-xs text-secondary">
                {r.role} <span className="text-primary">{r.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const NewsTeam = ({
    name,
    rows,
    tone,
  }: {
    name: string;
    rows: { name: string; reason: string }[];
    tone: string;
  }) => (
    <div className="min-w-0">
      <p
        className={`mb-1.5 text-[13px] font-extrabold tracking-wide uppercase ${tone}`}
      >
        {name}
      </p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-secondary">No reported absences.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className="text-sm leading-snug">
              <span className="font-semibold">{r.name}</span>{" "}
              <span className="text-xs text-secondary">{r.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const hasNews = info.teamNews.home.length > 0 || info.teamNews.away.length > 0;
  const hasVenue = !!(info.venue || info.referees.length > 0 || w);
  const both = hasNews && hasVenue;

  const teamNewsCard = hasNews ? (
    <div className="rounded-xl border-[0.75px] border-line bg-surface p-4 shadow-card">
      <p className={cardTitle}>Team news</p>
      <div className="space-y-4">
        <NewsTeam name={homeName} rows={info.teamNews.home} tone="text-red" />
        <NewsTeam name={awayName} rows={info.teamNews.away} tone="text-navy" />
      </div>
    </div>
  ) : null;

  const venueCard = hasVenue ? (
    <div className="space-y-4 rounded-xl border-[0.75px] border-line bg-surface p-4 shadow-card">
      <p className={cardTitle}>Match day</p>
      {info.venue && (
        <Fact
          label="Venue"
          value={
            info.venue.city
              ? `${info.venue.name}, ${info.venue.city}`
              : info.venue.name
          }
          sub={
            info.venue.capacity
              ? `${info.venue.capacity.toLocaleString()} capacity`
              : undefined
          }
        />
      )}
      {info.referees.length > 0 && <RefereeBlock crew={info.referees} />}
      {w && (
        <div>
          <p className="text-[13px] text-secondary">Weather</p>
          <p className="text-[15px] font-semibold">{cap(w.description)}</p>
          {weatherSub && <p className="text-xs text-secondary">{weatherSub}</p>}
          {w.note && (
            <p className="mt-0.5 text-xs font-semibold text-red">{w.note}</p>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="@container">
      <div className={both ? "grid gap-3 @xl:grid-cols-2" : "space-y-3"}>
        {teamNewsCard}
        {venueCard}
      </div>
    </div>
  );
}
