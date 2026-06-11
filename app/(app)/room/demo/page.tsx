import type { Metadata } from "next";
import { AudioBar } from "@/components/AudioBar";
import { MatchHeader } from "@/components/MatchHeader";
import { RoomShell } from "@/components/RoomShell";

export const metadata: Metadata = {
  title: "Arsenal vs Chelsea (demo room)",
};

/**
 * Demo room with static placeholder data — exists to exercise the Phase 1
 * layout shells. Real rooms (per fixture, stateful) arrive in Phase 4.
 */
export default function DemoRoomPage() {
  return (
    // 3.5rem header above; desktop reserves ~50px at the bottom for the fixed audio bar
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:pb-[50px]">
      <MatchHeader
        home="Arsenal"
        away="Chelsea"
        homeScore={2}
        awayScore={1}
        state="live_2h"
        clock="78:40"
        listeners={47}
      />

      {/* Mobile: compact audio strip under the match header */}
      <div className="border-b border-line bg-surface lg:hidden">
        <AudioBar commentator="ClockEndKev" live />
      </div>

      <RoomShell />

      {/* Desktop: persistent bottom audio bar (~50px, listener variant) */}
      <div className="fixed inset-x-0 bottom-0 z-40 hidden h-[50px] border-t border-line bg-surface lg:block">
        <div className="mx-auto h-full max-w-7xl [&>div]:h-full [&>div]:py-0">
          <AudioBar commentator="ClockEndKev" live />
        </div>
      </div>
    </div>
  );
}
