import type { LineupPlayer, SideLineup } from "@/lib/stats";

/**
 * Line-ups on a pitch (Phase 11): the home XI on the top half, the away XI on
 * the bottom, both attacking the centre line. Each player is placed from their
 * Sportmonks formation field "line:position" — `line` (1 = keeper … N =
 * forwards) is the row, `slot` (the ":position" half) is the true left→right
 * order within the row. Slot-ascending maps left→right for both halves, so no
 * mirroring is needed. Falls back to the text line-ups when positions are
 * missing. Labels sit on each team's own-goal side, away from the busy centre.
 */

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

type Placed = { p: LineupPlayer; x: number; y: number };
type FotmobMap = Record<number, string>;

/** A player's outbound link: their resolved Fotmob profile, or a Fotmob search
 *  as a fallback so every name stays clickable. */
function playerHref(p: LineupPlayer, fotmob: FotmobMap): string {
  return fotmob[p.playerId] ?? `https://www.fotmob.com/search?q=${encodeURIComponent(p.name)}`;
}

/** Place a side's starters: group by formation line, order each line left→right
 *  by slot, spread evenly across the width. Keeper sits at the team's own end;
 *  forwards stop short of the centre so the two front lines don't collide. */
function placeSide(starters: LineupPlayer[], home: boolean): Placed[] {
  const byLine = new Map<number, LineupPlayer[]>();
  const noLine: LineupPlayer[] = []; // position-less (e.g. a commentator-added starter)
  for (const p of starters) {
    if (p.line == null) {
      noLine.push(p);
      continue;
    }
    const arr = byLine.get(p.line);
    if (arr) arr.push(p);
    else byLine.set(p.line, [p]);
  }
  const lines = [...byLine.keys()].sort((a, b) => a - b);
  const maxLine = lines[lines.length - 1] ?? 1;
  const placed: Placed[] = [];
  for (const l of lines) {
    const row = byLine
      .get(l)!
      .slice()
      .sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99) || (a.jersey ?? 99) - (b.jersey ?? 99));
    const frac = maxLine > 1 ? (l - 1) / (maxLine - 1) : 0; // 0 keeper … 1 forwards
    // keeper 8% from own end → forwards stop ~42% (16% no-man's-land at centre)
    const y = home ? 8 + frac * 34 : 92 - frac * 34;
    row.forEach((p, i) => {
      placed.push({ p, x: ((i + 1) / (row.length + 1)) * 100, y });
    });
  }
  // position-less starters: place them in a residual front row so they're visible
  // rather than dropped (they'd otherwise collapse onto the keeper).
  if (noLine.length) {
    const y = home ? 46 : 54;
    noLine.forEach((p, i) => {
      placed.push({ p, x: ((i + 1) / (noLine.length + 1)) * 100, y });
    });
  }
  return placed;
}

function Marker({ p, x, y, home, href }: Placed & { home: boolean; href: string }) {
  // home labels sit above the disc (toward the top goal), away below — both
  // point outward, keeping names clear of the centre line. Both the number disc
  // AND the name link to the player's profile (founder 2026-07-02).
  const sub = p.cameOnFor;
  const circle = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={p.name}
      className="relative block"
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold tabular-nums shadow ${
          home ? "bg-navy text-white" : "bg-red text-white"
        }`}
      >
        {p.jersey ?? ""}
      </span>
      {sub && (
        // came-on badge: a small circle at top-right holding the number of the
        // player they replaced (green = on). Tooltip spells out the swap.
        <span
          className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-green px-0.5 text-[8px] font-bold tabular-nums text-white shadow ring-1 ring-canvas"
          title={`On ${sub.minute}${sub.number != null ? ` for #${sub.number}` : ""}`}
        >
          {sub.number ?? "↑"}
        </span>
      )}
    </a>
  );
  const label = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={p.name}
      className="max-w-[92px] truncate rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-white hover:underline"
    >
      {lastName(p.name)}
    </a>
  );
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {home ? label : circle}
      {home ? circle : label}
    </div>
  );
}

function SideHeading({ side }: { side: SideLineup | null }) {
  if (!side) return <span className="text-secondary">—</span>;
  return (
    <span className="truncate font-semibold">
      {side.teamName}
      {side.formation && <span className="ml-1 text-secondary">· {side.formation}</span>}
    </span>
  );
}

function Subs({ side, fotmob }: { side: SideLineup | null; fotmob: FotmobMap }) {
  if (!side || side.bench.length === 0) return null;
  // players who left the pitch carry the minute they were subbed off (in parens);
  // the rest is the unused bench. Every name links to its Fotmob profile. Title
  // is a display headline over the list (founder 2026-07-02).
  return (
    <div className="min-w-0">
      <p className="display mb-2 text-lg">{side.teamName} subs</p>
      <p className="text-sm leading-relaxed">
        {side.bench.map((p, i) => (
          <span key={p.playerId}>
            {i > 0 && ", "}
            <a
              href={playerHref(p, fotmob)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {lastName(p.name)}
            </a>
            {p.subbedOffAt && (
              <span className="text-secondary"> ({p.subbedOffAt})</span>
            )}
          </span>
        ))}
      </p>
    </div>
  );
}

export function PitchLineup({
  home,
  away,
  fotmob = {},
}: {
  home: SideLineup | null;
  away: SideLineup | null;
  fotmob?: FotmobMap;
}) {
  const homeMarks = home ? placeSide(home.starters, true) : [];
  const awayMarks = away ? placeSide(away.starters, false) : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <SideHeading side={home} />
        <SideHeading side={away} />
      </div>

      <div
        className="relative w-full overflow-hidden rounded-xl border border-line"
        style={{
          aspectRatio: "0.72",
          background:
            "repeating-linear-gradient(0deg, #15803d 0 9%, #16703a 9% 18%)",
        }}
      >
        {/* field markings */}
        <div className="absolute inset-x-0 top-1/2 border-t border-white/40" />
        <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
        <div className="absolute left-1/2 top-0 h-[12%] w-[58%] -translate-x-1/2 border border-t-0 border-white/40" />
        <div className="absolute left-1/2 bottom-0 h-[12%] w-[58%] -translate-x-1/2 border border-b-0 border-white/40" />

        {homeMarks.map((m) => (
          <Marker key={m.p.playerId} {...m} home href={playerHref(m.p, fotmob)} />
        ))}
        {awayMarks.map((m) => (
          <Marker key={m.p.playerId} {...m} home={false} href={playerHref(m.p, fotmob)} />
        ))}
      </div>

      <div className="@container pt-3">
        <div className="grid gap-x-6 gap-y-4 @md:grid-cols-2">
          <Subs side={home} fotmob={fotmob} />
          <Subs side={away} fotmob={fotmob} />
        </div>
      </div>
    </div>
  );
}
