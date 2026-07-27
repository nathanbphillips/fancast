import Link from "next/link";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { Countdown } from "@/components/room/Countdown";
import { RsvpButton } from "@/components/matches/RsvpButton";
import { RsvpIntent } from "@/components/matches/RsvpIntent";
import { WaitingRoomWatcher } from "@/components/room/WaitingRoomWatcher";

/**
 * Static, non-interactive, grayed silhouette of the matchday room, blurred
 * behind the "doors open soon" card. Deliberately generic — no real chat/stats
 * data and no realtime — so it reads as "coming soon" and never leaks anything.
 */
function RoomSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-40 blur-[3px] grayscale select-none"
    >
      {/* faux match header */}
      <div className="flex h-14 items-center justify-between border-b border-line px-5">
        <div className="h-5 w-32 rounded bg-line" />
        <div className="h-7 w-28 rounded-full bg-line" />
        <div className="h-5 w-24 rounded bg-line" />
      </div>

      {/* faux body: stats | chat */}
      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-3 rounded-xl border border-line p-4">
          <div className="h-4 w-24 rounded bg-line" />
          {["w-full", "w-11/12", "w-5/6", "w-full", "w-3/4", "w-full"].map((w, i) => (
            <div key={i} className={`h-2.5 rounded bg-line ${w}`} />
          ))}
        </div>
        <div className="space-y-4 rounded-xl border border-line p-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-line" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-24 rounded bg-line" />
                <div className={`h-2.5 rounded bg-line ${i % 2 ? "w-4/5" : "w-3/5"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* faux audio dock */}
      <div className="absolute inset-x-0 bottom-0 flex h-16 items-center gap-3 border-t border-line px-5">
        <div className="h-9 w-9 rounded-full bg-line" />
        <div className="h-8 flex-1 rounded bg-line" />
        <div className="h-9 w-24 rounded bg-line" />
      </div>
    </div>
  );
}

/**
 * The non-host, pre-open room screen: a centered "doors open soon" black box
 * (team names + live countdown + RSVP) floating over the grayed room skeleton.
 * A watcher auto-swaps to the live room when the host opens it; RsvpIntent
 * completes a deferred "RSVP for notifications" if the visitor arrived via
 * sign-in.
 */
export function WaitingRoomScreen({
  home,
  away,
  hostUsername,
  countdownIso,
  roomId,
  slug,
  signedIn,
  initialRsvped,
}: {
  home: string;
  away: string;
  hostUsername: string | null;
  countdownIso: string | null;
  roomId: string;
  slug: string;
  signedIn: boolean;
  initialRsvped: boolean;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4 py-12">
      <RoomSkeleton />

      <Link
        href="/"
        aria-label={brand.name}
        className="absolute top-4 left-4 z-20"
      >
        <Logo />
      </Link>

      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 p-8 text-center text-white"
        style={{
          background: "#0a0a0c",
          boxShadow: "0 40px 90px -30px rgba(0,0,0,.85)",
        }}
      >
        <div className="font-mono text-[11px] tracking-[0.12em] text-red uppercase">
          Doors open soon
        </div>
        <h1 className="display mt-3 t-h3">
          {away ? (
            <>
              {home} <span className="text-white/45">v</span> {away}
            </>
          ) : (
            home
          )}
        </h1>
        <p className="mx-auto mt-2.5 max-w-[320px] text-sm text-white/60">
          The room isn&apos;t open yet. This page updates on its own the moment
          {hostUsername ? ` @${hostUsername}` : " the host"} goes live.
        </p>

        <div className="mt-7">
          <Countdown targetIso={countdownIso} heading="Doors open in" bare />
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <RsvpButton
            roomId={roomId}
            slug={slug}
            initialRsvped={initialRsvped}
            signedIn={signedIn}
            variant="primary"
            label="RSVP for notifications"
          />
          <span className="font-mono text-[11px] text-white/45">
            {initialRsvped
              ? "You're on the list."
              : "We'll ping you when it opens."}
          </span>
        </div>
      </div>

      <WaitingRoomWatcher />
      <RsvpIntent roomId={roomId} signedIn={signedIn} />
    </div>
  );
}
