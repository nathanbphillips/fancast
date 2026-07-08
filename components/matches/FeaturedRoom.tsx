import Link from "next/link";
import type { ScheduleFixture, ScheduleRoom, LivePreview } from "@/lib/db/matches";
import type { RoomState } from "@/lib/db/types";
import { Avatar } from "@/components/Avatar";
import { Waveform } from "@/components/ui/Waveform";
import { Countdown } from "@/components/marketing/Countdown";
import { RsvpButton } from "@/components/matches/RsvpButton";
import { listeningLine, goingLine } from "@/lib/strings/attendance";

/**
 * The /matches featured hero (Matches.dc.html). When a room is genuinely LIVE
 * it renders the rich card: real scoreline (DB), a phase label (room state, NOT
 * a fabricated minute), and an "IN THE ROOM" preview whose listener count and
 * xG/possession/shots tiles come from real data (`LivePreview`) or are omitted.
 * When nothing is live it degrades to the soonest scheduled room as an honest
 * "NEXT UP" card (countdown + real RSVP count) — no invented live activity.
 * Founder rule: real data where it exists, never a fabricated number.
 */

const hostsOf = (r: ScheduleRoom) =>
  r.hostUsernames.length > 0 ? r.hostUsernames : [r.hostUsername];

/** 3-letter scoreboard badge from a team name ("Coventry City" -> "COV"). */
function abbr(team: string): string {
  const word = team.replace(/[^A-Za-z ]/g, "").trim().split(/\s+/)[0] ?? team;
  return word.slice(0, 3).toUpperCase();
}

/** Human phase label from room state (real; no fabricated clock minute). */
function phaseLabel(state: RoomState): string {
  switch (state) {
    case "pregame":
      return "Kick-off soon";
    case "live_1h":
      return "1st half";
    case "halftime":
      return "Half-time";
    case "live_2h":
      return "2nd half";
    case "extra_time":
      return "Extra time";
    case "postgame":
      return "Full-time";
    case "waiting":
      return "Waiting room";
    default:
      return "Live";
  }
}

function TeamBadge({ team, away = false }: { team: string; away?: boolean }) {
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-[11px] font-mono text-[11px] font-bold text-white"
      style={{ background: away ? "#0b6cae" : "#ef0107" }}
    >
      {abbr(team)}
    </span>
  );
}

export function FeaturedRoom({
  fixture,
  room,
  dateLabel,
  live,
  preview,
  signedIn,
}: {
  fixture: ScheduleFixture;
  room: ScheduleRoom;
  dateLabel: string;
  live: boolean;
  /** real listener count + live stats; only meaningful when `live` */
  preview: LivePreview | null;
  signedIn: boolean;
}) {
  const comp = fixture.round
    ? `${fixture.competition ?? "Premier League"} · ${fixture.round}`
    : (fixture.competition ?? "Premier League");
  const listeners = preview?.listeners ?? 0;

  // real live stat tiles — only figures that actually exist are shown
  const tiles: { v: string; l: string; red?: boolean }[] = [];
  if (preview?.stats) {
    if (preview.stats.xg != null)
      tiles.push({ v: preview.stats.xg.toFixed(2), l: "xG", red: true });
    if (preview.stats.possHome != null)
      tiles.push({ v: `${Math.round(preview.stats.possHome)}%`, l: "POSS" });
    if (preview.stats.shots != null)
      tiles.push({ v: String(preview.stats.shots), l: "SHOTS" });
  }

  return (
    <div className="mb-9">
      {/* eyebrow */}
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red">
          <span
            className={`h-2 w-2 rounded-full bg-red ${live ? "animate-fcpulse" : "animate-fc-blink"}`}
          />
          {live ? "LIVE NOW" : "NEXT UP"}
        </span>
        <span className="font-mono text-[12px] text-tertiary">
          {live ? "1 room open · doors are up" : dateLabel}
        </span>
      </div>

      <Link
        href={`/room/${room.slug}`}
        className="relative block overflow-hidden rounded-[20px] border p-7 transition-transform hover:-translate-y-[3px]"
        style={{
          background:
            "linear-gradient(120deg, rgba(239,1,7,.18), transparent 55%), var(--bg-surface)",
          borderColor: "rgba(239,1,7,.32)",
          boxShadow: "0 30px 60px -40px rgba(239,1,7,.5)",
        }}
      >
        <div className="relative z-[2] grid items-center gap-7 lg:grid-cols-[1.05fr_1fr]">
          {/* LEFT */}
          <div>
            <div className="mb-3.5 font-mono text-[11px] tracking-[0.06em] text-red uppercase">
              {dateLabel} · {comp}
            </div>

            {/* live scoreline (real score + phase label; no fabricated clock) */}
            {live && (
              <div className="mb-2.5 flex items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <TeamBadge team={fixture.home} />
                  <span className="display text-[40px] tabular-nums leading-none">
                    {fixture.homeScore ?? 0}
                  </span>
                </div>
                <div className="text-center">
                  <div className="font-mono text-[12px] font-bold text-red">
                    {phaseLabel(room.state)}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="display text-[40px] tabular-nums leading-none">
                    {fixture.awayScore ?? 0}
                  </span>
                  <TeamBadge team={fixture.away} away />
                </div>
              </div>
            )}

            <div className="display text-[30px] leading-[1.04]">
              {fixture.home} <span className="text-secondary">v</span>{" "}
              {fixture.away}
            </div>

            {/* host */}
            <div className="mt-3.5 mb-5 flex items-center gap-2.5">
              <Avatar src={null} name={hostsOf(room)[0]} size={32} />
              <div className="text-[12.5px] text-secondary">
                {room.blurb ? (
                  <span className="text-primary">{room.blurb}</span>
                ) : (
                  <span>
                    Hosted by{" "}
                    {hostsOf(room).map((h, i) => (
                      <span key={h}>
                        {i > 0 && " · "}@{h}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>

            {/* CTA */}
            {live ? (
              <div className="flex flex-wrap items-center gap-4">
                <span className="btn-grad-red inline-flex items-center gap-2 rounded-[11px] px-[22px] py-3 text-[14px] font-semibold text-white">
                  <span className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-white" />
                  Join the room →
                </span>
                {listeners > 0 && (
                  <span className="font-mono text-[12px] text-tertiary tabular-nums">
                    {listeningLine(listeners)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <span className="btn-grad-red inline-flex items-center gap-2 rounded-[11px] px-[22px] py-3 text-[14px] font-semibold text-white">
                  Join the waiting room →
                </span>
                <span className="font-mono text-[12px] text-tertiary tabular-nums">
                  <Countdown iso={fixture.kickoffUtc} /> to kickoff
                </span>
              </div>
            )}
          </div>

          {/* RIGHT: IN THE ROOM preview (live) or "what's inside" (next up) */}
          <div className="hidden rounded-2xl border border-line bg-canvas p-4 lg:block">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-red">
                <span
                  className={`h-1.5 w-1.5 rounded-full bg-red ${live ? "animate-fc-blink" : ""}`}
                />
                IN THE ROOM
              </span>
              {live && (
                <span className="font-mono text-[10px] text-tertiary">
                  {phaseLabel(room.state)}
                </span>
              )}
            </div>

            <Waveform bars={40} height={36} />

            {/* sample chat line (founder-authored demo; founder decision
                2026-07-08, self-attributed so no third-party privacy issue) */}
            {live && (
              <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2.5">
                <Avatar src={null} name="Nathan" size={24} />
                <div className="min-w-0 flex-1 text-[11px] leading-tight">
                  <span className="font-bold">Nathan</span>{" "}
                  <span className="text-secondary">Ødegaard, take a bow.</span>
                </div>
                <span className="shrink-0 font-mono text-[10px] font-bold text-red">
                  ▲142
                </span>
              </div>
            )}

            {live && tiles.length > 0 ? (
              <div
                className="mt-3 grid gap-2"
                style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}
              >
                {tiles.map((t) => (
                  <div
                    key={t.l}
                    className="rounded-[9px] bg-surface p-2.5 text-center"
                  >
                    <div
                      className={`display text-[16px] tabular-nums ${t.red ? "text-red" : ""}`}
                    >
                      {t.v}
                    </div>
                    <div className="font-mono text-[9px] text-tertiary">
                      {t.l}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 font-mono text-[11px] leading-[1.5] text-tertiary">
                Live fan audio, a chat worth reading and match stats, all in sync
                with your screen.
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* real RSVP count under a scheduled hero (live rooms show listeners) */}
      {!live && goingLine(room.rsvpCount) && (
        <div className="mt-3 flex items-center gap-3">
          <RsvpButton
            roomId={room.id}
            slug={room.slug}
            initialRsvped={room.viewerRsvped}
            signedIn={signedIn}
            size="sm"
          />
          <span className="font-mono text-[12px] text-tertiary tabular-nums">
            {goingLine(room.rsvpCount)}
          </span>
        </div>
      )}
    </div>
  );
}
