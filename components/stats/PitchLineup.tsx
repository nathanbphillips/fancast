import type { LineupPlayer, SideLineup } from "@/lib/stats";

/**
 * Line-ups on a pitch (Phase 11): the home XI on the top half, the away XI on
 * the bottom, both attacking the centre line — built from each player's
 * formation `line` (1 = keeper … N = forwards) and their order within the line.
 * Falls back to the text line-ups when formation positions aren't available.
 */

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

type Placed = { p: LineupPlayer; x: number; y: number };

/** Place a side's starters: group by formation line, spread each line evenly
 *  across the width; keeper at the team's own end, forwards near the centre. */
function placeSide(starters: LineupPlayer[], home: boolean): Placed[] {
  const byLine = new Map<number, LineupPlayer[]>();
  for (const p of starters) {
    const l = p.line ?? 1;
    const arr = byLine.get(l);
    if (arr) arr.push(p);
    else byLine.set(l, [p]);
  }
  const lines = [...byLine.keys()].sort((a, b) => a - b);
  const maxLine = lines[lines.length - 1] ?? 1;
  const placed: Placed[] = [];
  for (const l of lines) {
    const row = byLine.get(l)!;
    const frac = maxLine > 1 ? (l - 1) / (maxLine - 1) : 0; // 0 keeper … 1 forwards
    const y = home ? 7 + frac * 40 : 93 - frac * 40; // top half vs bottom half
    row.forEach((p, i) => {
      placed.push({ p, x: ((i + 1) / (row.length + 1)) * 100, y });
    });
  }
  return placed;
}

function Marker({ p, x, y, home }: Placed & { home: boolean }) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold tabular-nums shadow ${
          home ? "bg-gold text-canvas" : "bg-red text-white"
        }`}
      >
        {p.jersey ?? ""}
      </span>
      <span className="mt-0.5 max-w-[68px] truncate rounded-sm bg-black/45 px-1 text-[9px] font-semibold leading-tight text-white">
        {lastName(p.name)}
      </span>
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

function Subs({ side }: { side: SideLineup | null }) {
  if (!side || side.bench.length === 0) return null;
  return (
    <p className="text-[11px] leading-snug text-secondary">
      <span className="font-semibold text-primary">{side.teamName} subs:</span>{" "}
      {side.bench.map((p) => lastName(p.name)).join(", ")}
    </p>
  );
}

export function PitchLineup({
  home,
  away,
}: {
  home: SideLineup | null;
  away: SideLineup | null;
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
          aspectRatio: "3 / 4",
          background:
            "repeating-linear-gradient(0deg, #15803d 0 9%, #16703a 9% 18%)",
        }}
      >
        {/* field markings */}
        <div className="absolute inset-x-0 top-1/2 border-t border-white/40" />
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
        <div className="absolute left-1/2 top-0 h-[13%] w-[56%] -translate-x-1/2 border border-t-0 border-white/40" />
        <div className="absolute left-1/2 bottom-0 h-[13%] w-[56%] -translate-x-1/2 border border-b-0 border-white/40" />

        {homeMarks.map((m) => (
          <Marker key={m.p.playerId} {...m} home />
        ))}
        {awayMarks.map((m) => (
          <Marker key={m.p.playerId} {...m} home={false} />
        ))}
      </div>

      <div className="space-y-1 pt-1">
        <Subs side={home} />
        <Subs side={away} />
      </div>
    </div>
  );
}
