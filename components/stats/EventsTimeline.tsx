import type { EventKind, TimelineEvent } from "@/lib/stats";

/**
 * Match events newest-first. Minutes come straight from the event data — there
 * is NO ticking clock here (golden rule 6: the event-sourced header is the only
 * clock). A red/navy left accent marks the home/away side.
 */

const KIND_LABEL: Record<EventKind, string> = {
  goal: "Goal",
  owngoal: "Own goal",
  penalty: "Penalty",
  yellowcard: "Yellow card",
  redcard: "Red card",
  substitution: "Substitution",
  var: "VAR",
};

function KindIcon({ kind }: { kind: EventKind }) {
  if (kind === "yellowcard")
    return <span aria-hidden className="inline-block h-4 w-2.5 rounded-[2px] bg-gold" />;
  if (kind === "redcard")
    return <span aria-hidden className="inline-block h-4 w-2.5 rounded-[2px] bg-red" />;
  if (kind === "substitution")
    return <span aria-hidden className="text-green">⇄</span>;
  if (kind === "var")
    return (
      <span aria-hidden className="rounded bg-raised px-1 text-[10px] font-bold text-secondary">
        VAR
      </span>
    );
  // goal / owngoal / penalty
  return <span aria-hidden>⚽</span>;
}

export function EventsTimeline({
  events,
  size = "compact",
}: {
  events: TimelineEvent[];
  size?: "compact" | "radio";
}) {
  const big = size === "radio";
  if (events.length === 0) {
    return (
      <p className={`text-secondary ${big ? "text-base" : "text-sm"}`}>
        No events yet — goals, cards, and subs appear here as they happen.
      </p>
    );
  }
  const ordered = [...events].reverse(); // newest first
  return (
    <ul className={big ? "space-y-3" : "space-y-2"}>
      {ordered.map((e) => {
        const min = `${e.minute}${e.extraMinute ? `+${e.extraMinute}` : ""}'`;
        const isGoal = e.kind === "goal" || e.kind === "owngoal" || e.kind === "penalty";
        return (
          <li
            key={e.id}
            aria-label={`${min} ${KIND_LABEL[e.kind]} — ${e.player}`}
            className={`flex items-start gap-2 border-l-2 pl-2 ${
              e.side === "home" ? "border-red" : "border-navy"
            } ${big ? "text-base" : "text-sm"}`}
          >
            <span className="w-9 shrink-0 font-semibold tabular-nums text-secondary">
              {min}
            </span>
            <span className="mt-0.5 w-5 shrink-0 text-center leading-none">
              <KindIcon kind={e.kind} />
            </span>
            <span className="min-w-0">
              <span className={isGoal ? "font-semibold" : ""}>{e.player}</span>
              {e.kind === "substitution" && e.relatedPlayer && (
                <span className="text-secondary"> for {e.relatedPlayer}</span>
              )}
              {e.result && (
                <span className="ml-1 font-semibold tabular-nums">{e.result}</span>
              )}
              {e.info && e.kind !== "substitution" && (
                <span className="text-secondary"> · {e.info}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
