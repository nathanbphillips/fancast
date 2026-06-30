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

  // label above value, left-aligned — wraps cleanly in a narrow (1/3-width) column
  const Fact = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div>
      <p className={`text-secondary ${big ? "text-sm" : "text-xs"}`}>{label}</p>
      <p className={`font-semibold ${text}`}>{value}</p>
      {sub && <p className="text-[11px] text-secondary">{sub}</p>}
    </div>
  );

  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const w = info.weather;
  // compact, unit-labelled readout — wind converted to mph upstream (was a bare "5")
  const weatherSub = w
    ? [
        w.temp != null ? `${Math.round(w.temp)}°C` : null,
        w.windMph != null ? `Wind ${w.windMph} mph` : null,
        w.humidity ? `Humidity ${w.humidity}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  // Match officials: head referee headlined, the rest of the crew listed with
  // their designation (1st/2nd Assistant, 4th Official, VAR…).
  const RefereeBlock = ({ crew }: { crew: { role: string; name: string }[] }) => {
    const [head, ...rest] = crew;
    return (
      <div>
        {/* label by the head official's actual role — usually "Referee", but
            pre-match the head ref may not be confirmed yet (only assistants). */}
        <p className={`text-secondary ${big ? "text-sm" : "text-xs"}`}>{head.role || "Referee"}</p>
        <p className={`font-semibold ${text}`}>{head.name}</p>
        {rest.length > 0 && (
          <ul className="mt-0.5 space-y-0.5">
            {rest.map((r, i) => (
              <li key={`${r.role}-${i}`} className="text-[11px] text-secondary">
                {r.role} — <span className="text-primary">{r.name}</span>
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
        className={`mb-1 font-display text-[11px] font-bold tracking-wider uppercase ${tone}`}
      >
        {name}
      </p>
      {rows.length === 0 ? (
        <p className="text-[11px] text-secondary">No reported absences.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className={`${text} leading-tight`}>
              {r.name}
              <span className="text-[11px] text-secondary"> — {r.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const hasNews = info.teamNews.home.length > 0 || info.teamNews.away.length > 0;

  return (
    <div className="space-y-3">
      {hasNews && (
        <div className="rounded-xl border-[0.75px] border-line bg-surface p-3 shadow-card">
          <p className="mb-2 font-display text-[11px] font-bold tracking-wider text-secondary uppercase">
            Team news
          </p>
          <div className="space-y-3">
            <NewsTeam name={homeName} rows={info.teamNews.home} tone="text-red" />
            <NewsTeam name={awayName} rows={info.teamNews.away} tone="text-navy" />
          </div>
        </div>
      )}

      {(info.venue || info.referees.length > 0 || w) && (
        <div className="space-y-3 rounded-xl border-[0.75px] border-line bg-surface p-3 shadow-card">
          {info.venue && (
            <Fact
              label="Venue"
              value={info.venue.city ? `${info.venue.name}, ${info.venue.city}` : info.venue.name}
              sub={info.venue.capacity ? `${info.venue.capacity.toLocaleString()} capacity` : undefined}
            />
          )}
          {info.referees.length > 0 && <RefereeBlock crew={info.referees} />}
          {w && (
            <div>
              <p className={`text-secondary ${big ? "text-sm" : "text-xs"}`}>Weather</p>
              <p className={`font-semibold ${text}`}>{cap(w.description)}</p>
              {weatherSub && <p className="text-[11px] text-secondary">{weatherSub}</p>}
              {w.note && <p className="mt-0.5 text-[11px] font-semibold text-gold">{w.note}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
