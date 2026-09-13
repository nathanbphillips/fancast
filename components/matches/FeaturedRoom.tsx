import type { ReactNode } from "react";
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
  // Only rendered on the live (red) block: home = paper-filled chip, away =
  // paper-outline chip. Flat token colors, no club branding.
  return (
    <span
      className={`flex h-10 w-10 items-center justify-center border-2 border-on-red font-mono text-[11px] font-bold ${
        away ? "text-on-red" : "bg-on-red text-red-fill"
      }`}
    >
      {abbr(team)}
    </span>
  );
}

/** The featured card is a full-card link when the room is enterable (live, or
 *  the waiting room is joinable); otherwise a plain container, so the CTA (an
 *  RSVP action) isn't an illegal nested link. Programme treatment: live =
 *  solid red block, scheduled = solid ink block (inverts in dark). */
function CardShell({
  href,
  live,
  children,
}: {
  href: string | null;
  live: boolean;
  children: ReactNode;
}) {
  const base = `relative block overflow-hidden p-7 ${
    live ? "bg-red-fill text-on-red" : "bg-inverted text-inverted-fg"
  }`;
  return href ? (
    <Link href={href} className={base}>
      {children}
    </Link>
  ) : (
    <div className={base}>{children}</div>
  );
}

export function FeaturedRoom({
  fixture,
  room,
  dateLabel,
  live,
  preview,
  signedIn,
  showListeners = false,
}: {
  fixture: ScheduleFixture;
  room: ScheduleRoom;
  dateLabel: string;
  live: boolean;
  /** real listener count + live stats; only meaningful when `live` */
  preview: LivePreview | null;
  signedIn: boolean;
  /** listener count is host-only (founder 2026-09-12); the page passes true
   *  only when the viewer hosts this room (or is an admin) */
  showListeners?: boolean;
}) {
  const comp = fixture.round
    ? `${fixture.competition ?? "Premier League"} · ${fixture.round}`
    : (fixture.competition ?? "Premier League");
  const listeners = preview?.listeners ?? 0;

  // A scheduled room's CTA flips from "RSVP for notifications" to "Join the
  // waiting room" 30 min before the show's start (broadcastStart). Live rooms
  // are always joinable. Before that window, we send people to RSVP/sign-in
  // rather than a dead countdown screen.
  const joinable =
    live ||
    Date.now() >= new Date(room.broadcastStart).getTime() - 30 * 60 * 1000;

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

  // on-fill text/rule classes: paper-on-red for the live block, paper/ink for
  // the scheduled ink block (which inverts in dark)
  const muted = live ? "text-on-red/85" : "text-inverted-fg/70";
  const rule = live ? "border-on-red/40" : "border-inverted-fg/30";

  return (
    <div className="mb-9">
      {/* eyebrow */}
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.1em] text-red">
          <span
            className={`h-2 w-2 rounded-full bg-red-fill ${live ? "animate-fcpulse" : "animate-fc-blink"}`}
          />
          {live ? "LIVE NOW" : "NEXT UP"}
        </span>
        <span className="text-[12px] text-tertiary italic">
          {live ? "1 room open · doors are up" : dateLabel}
        </span>
      </div>

      <CardShell href={joinable ? `/room/${room.slug}` : null} live={live}>
        <div className="relative z-[2] grid items-center gap-7 lg:grid-cols-[1.05fr_1fr]">
          {/* LEFT */}
          <div>
            <div className={`mb-3.5 font-mono text-[11px] tracking-[0.1em] uppercase ${muted}`}>
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
                  <div className="font-mono text-[12px] font-bold tracking-[0.08em] text-on-red uppercase">
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
              {fixture.home}{" "}
              <span
                className={`font-mono text-[18px] normal-case ${live ? "text-on-red/80" : "text-gold"}`}
              >
                v
              </span>{" "}
              {fixture.away}
            </div>

            {/* host */}
            <div className="mt-3.5 mb-5 flex items-center gap-2.5">
              <Avatar src={null} name={hostsOf(room)[0]} size={32} />
              <div className={`text-[12.5px] italic ${muted}`}>
                {room.blurb ? (
                  <span className={live ? "text-on-red" : "text-inverted-fg"}>
                    {room.blurb}
                  </span>
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
                <span className="inline-flex items-center gap-2 border-2 border-on-red px-[22px] py-3 font-mono text-[14px] font-semibold tracking-[0.08em] text-on-red">
                  <span className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-on-red" />
                  Join the room →
                </span>
                {showListeners && listeners > 0 && (
                  <span className="font-mono text-[12px] text-on-red/85 tabular-nums">
                    {listeningLine(listeners)}
                  </span>
                )}
              </div>
            ) : joinable ? (
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-2 border-2 border-inverted-fg px-[22px] py-3 font-mono text-[14px] font-semibold tracking-[0.08em] text-inverted-fg">
                  Join the waiting room →
                </span>
                <span className="font-mono text-[12px] text-inverted-fg/70 tabular-nums">
                  <span className="text-gold">
                    <Countdown iso={fixture.kickoffUtc} />
                  </span>{" "}
                  to kickoff
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <RsvpButton
                  roomId={room.id}
                  slug={room.slug}
                  initialRsvped={room.viewerRsvped}
                  signedIn={signedIn}
                  variant="onInk"
                  label="RSVP for notifications"
                />
                <span className="font-mono text-[12px] text-inverted-fg/70 tabular-nums">
                  We&apos;ll notify you when the room opens ·{" "}
                  <span className="text-gold">
                    <Countdown iso={fixture.kickoffUtc} />
                  </span>{" "}
                  to kickoff
                </span>
              </div>
            )}
          </div>

          {/* RIGHT: IN THE ROOM preview (live) or "what's inside" (next up) */}
          <div className={`hidden border p-4 lg:block ${rule}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] ${live ? "text-on-red" : "text-inverted-fg"}`}>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${live ? "animate-fc-blink bg-on-red" : "bg-inverted-fg"}`}
                />
                IN THE ROOM
              </span>
              {live && (
                <span className={`font-mono text-[10px] ${muted}`}>
                  {phaseLabel(room.state)}
                </span>
              )}
            </div>

            <Waveform bars={40} height={36} />

            {/* sample chat line (founder-authored demo; founder decision
                2026-07-08, self-attributed so no third-party privacy issue) */}
            {live && (
              <div className={`mt-3 flex items-center gap-2 border px-3 py-2.5 ${rule}`}>
                <Avatar src={null} name="Nathan" size={24} />
                <div className="min-w-0 flex-1 text-[11px] leading-tight">
                  <span className="font-bold">Nathan</span>{" "}
                  <span className="text-on-red/85 italic">Ødegaard, take a bow.</span>
                </div>
                <span className="shrink-0 font-mono text-[10px] font-bold text-on-red">
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
                    className={`border p-2.5 text-center ${rule}`}
                  >
                    <div className="display text-[16px] text-on-red tabular-nums">
                      {t.v}
                    </div>
                    <div className={`font-mono text-[9px] tracking-[0.08em] ${muted}`}>
                      {t.l}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`mt-3 text-[11px] leading-[1.5] italic ${muted}`}>
                Live fan audio, a chat worth reading and match stats, all in sync
                with your screen.
              </p>
            )}
          </div>
        </div>
      </CardShell>

      {/* real RSVP count under a scheduled hero (live rooms show listeners). The
          RSVP toggle shows here only when the room is already joinable — before
          that, RSVP is the card's primary CTA, so we avoid a duplicate. */}
      {!live && goingLine(room.rsvpCount) && (
        <div className="mt-3 flex items-center gap-3">
          {joinable && (
            <RsvpButton
              roomId={room.id}
              slug={room.slug}
              initialRsvped={room.viewerRsvped}
              signedIn={signedIn}
              size="sm"
            />
          )}
          <span className="font-mono text-[12px] text-tertiary tabular-nums">
            {goingLine(room.rsvpCount)}
          </span>
        </div>
      )}
    </div>
  );
}
