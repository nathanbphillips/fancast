import type { MatchHistory, TeamStanding } from "@/lib/history";

/**
 * History tab/pane (pre-game): each team's league-table standing + last-5 form,
 * side by side, from the cached /api/history proxy (lib/history). Shows the most
 * recent finished season's table until the new season has played games.
 */

function FormChips({ form }: { form: ("W" | "D" | "L")[] }) {
  if (form.length === 0) return <span className="text-secondary">—</span>;
  const tone = (r: string) =>
    r === "W" ? "bg-green text-canvas" : r === "L" ? "bg-red text-white" : "bg-raised text-secondary";
  return (
    <span className="flex gap-0.5">
      {form.map((r, i) => (
        <span
          key={i}
          className={`inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold ${tone(r)}`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export function MatchHistoryPanel({
  history,
  loading,
  homeName,
  awayName,
  size = "compact",
}: {
  history: MatchHistory | null;
  loading?: boolean;
  homeName: string;
  awayName: string;
  size?: "compact" | "radio";
}) {
  const big = size === "radio";
  const text = big ? "text-sm" : "text-[13px]";

  const home = history?.home ?? null;
  const away = history?.away ?? null;

  if (!home && !away) {
    return (
      <p className={`text-secondary ${big ? "text-base" : "text-sm"}`}>
        {loading
          ? "Loading form & table…"
          : "League table & form appear closer to kickoff."}
      </p>
    );
  }

  const wdl = (t: TeamStanding | null) =>
    t ? `${t.won}-${t.drawn}-${t.lost}` : "—";
  const gfga = (t: TeamStanding | null) =>
    t ? `${t.goalsFor}/${t.goalsAgainst}` : "—";
  const gd = (t: TeamStanding | null) =>
    t == null ? "—" : t.goalDiff > 0 ? `+${t.goalDiff}` : `${t.goalDiff}`;

  const Row = ({
    label,
    h,
    a,
  }: {
    label: string;
    h: React.ReactNode;
    a: React.ReactNode;
  }) => (
    <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 ${text}`}>
      <span className="text-left font-semibold tabular-nums">{h}</span>
      <span className={`text-center text-secondary ${big ? "text-xs" : "text-[11px]"}`}>
        {label}
      </span>
      <span className="text-right font-semibold tabular-nums">{a}</span>
    </div>
  );

  return (
    <div className="space-y-1.5">
      {history?.seasonName && (
        <p className={`text-secondary ${big ? "text-xs" : "text-[11px]"}`}>
          {history.seasonName} table
        </p>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className={`truncate text-left font-bold ${text}`}>{homeName}</span>
        <span aria-hidden className="text-center text-[11px] text-secondary">
          vs
        </span>
        <span className={`truncate text-right font-bold ${text}`}>{awayName}</span>
      </div>
      <Row
        label="Pos"
        h={home?.position ?? "—"}
        a={away?.position ?? "—"}
      />
      <Row label="Pld" h={home?.played ?? "—"} a={away?.played ?? "—"} />
      <Row label="W-D-L" h={wdl(home)} a={wdl(away)} />
      <Row label="GF/GA" h={gfga(home)} a={gfga(away)} />
      <Row label="GD" h={gd(home)} a={gd(away)} />
      <Row label="Pts" h={home?.points ?? "—"} a={away?.points ?? "—"} />
      <Row
        label="Form"
        h={<FormChips form={home?.form ?? []} />}
        a={<FormChips form={away?.form ?? []} />}
      />
    </div>
  );
}
