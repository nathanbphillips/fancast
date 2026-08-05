import "server-only";
import { createServiceClient } from "@/lib/db/server";

/**
 * A host's recording library (founder 2026-08-05). Every room they hosted that
 * produced a recording, newest first, with ready files pre-signed for a
 * one-click download. Co-hosts see the same set (FR-25.7: both accepted hosts
 * get full recording rights).
 */

const REC_BUCKET = "recordings";
const SIGNED_TTL = 60 * 60; // 1h, same as the room panel

export type HostRecording = {
  roomId: string;
  slug: string | null;
  title: string;
  kickoffUtc: string | null;
  startedAt: string;
  endedAt: string | null;
  status: string;
  durationSeconds: number | null;
  error: string | null;
  segmentCount: number;
  fullUrl: string | null;
  zipUrl: string | null;
};

export async function loadHostRecordings(
  userId: string,
): Promise<HostRecording[]> {
  const service = createServiceClient();

  // rooms this user actually hosts (accepted co-hosts included)
  const { data: hosted } = await service
    .from("room_hosts")
    .select("room_id")
    .eq("user_id", userId)
    .eq("status", "accepted");
  const roomIds = (hosted ?? []).map((h) => h.room_id as string);
  if (roomIds.length === 0) return [];

  const { data: recs } = await service
    .from("recordings")
    .select(
      "id, room_id, status, duration_seconds, error, started_at, ended_at, full_mp3_path, zip_path",
    )
    .in("room_id", roomIds)
    .order("started_at", { ascending: false });
  if (!recs || recs.length === 0) return [];

  // room + fixture for the display name
  const { data: rooms } = await service
    .from("rooms")
    .select(
      "id, slug, title, kind, fixture:fixtures!rooms_fixture_id_fkey(home_team, away_team, kickoff_utc)",
    )
    .in(
      "id",
      recs.map((r) => r.room_id as string),
    );
  const roomById = new Map(
    (rooms ?? []).map((r) => [r.id as string, r as Record<string, unknown>]),
  );

  // segment counts in one query
  const { data: segs } = await service
    .from("recording_segments")
    .select("recording_id")
    .in(
      "recording_id",
      recs.map((r) => r.id as string),
    );
  const segCount = new Map<string, number>();
  for (const s of segs ?? []) {
    const k = s.recording_id as string;
    segCount.set(k, (segCount.get(k) ?? 0) + 1);
  }

  const out: HostRecording[] = [];
  for (const r of recs) {
    const room = roomById.get(r.room_id as string);
    const fxRaw = room?.fixture as unknown;
    const fx = (Array.isArray(fxRaw) ? fxRaw[0] : fxRaw) as
      | { home_team: string; away_team: string; kickoff_utc: string }
      | null
      | undefined;
    const title =
      (room?.title as string | null) ??
      (fx ? `${fx.home_team} vs ${fx.away_team}` : "Room");

    // only sign what exists; a failed/empty run has nothing to hand out
    let fullUrl: string | null = null;
    let zipUrl: string | null = null;
    if (r.status === "ready") {
      if (r.full_mp3_path) {
        const { data } = await service.storage
          .from(REC_BUCKET)
          .createSignedUrl(r.full_mp3_path as string, SIGNED_TTL);
        fullUrl = data?.signedUrl ?? null;
      }
      if (r.zip_path) {
        const { data } = await service.storage
          .from(REC_BUCKET)
          .createSignedUrl(r.zip_path as string, SIGNED_TTL);
        zipUrl = data?.signedUrl ?? null;
      }
    }

    out.push({
      roomId: r.room_id as string,
      slug: (room?.slug as string | null) ?? null,
      title,
      kickoffUtc: fx?.kickoff_utc ?? null,
      startedAt: r.started_at as string,
      endedAt: (r.ended_at as string | null) ?? null,
      status: r.status as string,
      durationSeconds: (r.duration_seconds as number | null) ?? null,
      error: (r.error as string | null) ?? null,
      segmentCount: segCount.get(r.id as string) ?? 0,
      fullUrl,
      zipUrl,
    });
  }
  return out;
}
