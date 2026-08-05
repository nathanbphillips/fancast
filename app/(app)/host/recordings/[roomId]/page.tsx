import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserAndProfile, createServiceClient } from "@/lib/db/server";
import { isRoomHost } from "@/lib/roomHosts";
import { isAdmin } from "@/lib/roles";
import { DownloadsPanel } from "@/components/room/DownloadsPanel";

export const metadata: Metadata = {
  title: "Recording",
  robots: { index: false, follow: false },
};

/**
 * One show's recording, outside the room (founder 2026-08-05). The room's
 * wrapped state shows the same panel, but a host shouldn't have to re-enter a
 * finished room to get their files — and after the room is gone from view this
 * is the durable place to come back to.
 */
export default async function HostRecordingPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user || !profile) {
    redirect(`/signin?next=/host/recordings/${roomId}`);
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select(
      "id, title, fixture:fixtures!rooms_fixture_id_fkey(home_team, away_team)",
    )
    .eq("id", roomId)
    .maybeSingle();
  if (!room) notFound();

  // same gate as /api/recordings: accepted hosts (either co-host) or an admin
  if (
    !(await isRoomHost(service, user.id, roomId)) &&
    !isAdmin(user.id, profile)
  ) {
    notFound(); // don't reveal that the room exists
  }

  const fxRaw = room.fixture as unknown;
  const fx = (Array.isArray(fxRaw) ? fxRaw[0] : fxRaw) as
    | { home_team: string; away_team: string }
    | null
    | undefined;
  const title =
    (room.title as string | null) ??
    (fx ? `${fx.home_team} vs ${fx.away_team}` : "Your show");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/host/recordings"
        className="text-sm text-secondary transition-colors hover:text-primary"
      >
        ← All recordings
      </Link>
      <h1 className="t-h2 mt-2">{title}</h1>
      {/* the panel owns status, polling, downloads, marker nudging and recut */}
      <DownloadsPanel roomId={roomId} />
    </div>
  );
}
