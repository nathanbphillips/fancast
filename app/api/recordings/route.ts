import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { brand, recordingFileName } from "@/lib/brand";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { processRecording } from "@/lib/recording";
import { isAdmin } from "@/lib/roles";

const REC_BUCKET = "recordings";

/** A recording and its files belong to the room's commentator (+admin). */
async function authorizeRoom(
  service: ReturnType<typeof createServiceClient>,
  roomId: string,
  userId: string,
  admin: boolean,
) {
  const { data: room } = await service
    .from("rooms")
    .select("id, commentator_id, fixture:fixtures(home_team, away_team, kickoff_utc)")
    .eq("id", roomId)
    .maybeSingle<{
      id: string;
      commentator_id: string;
      fixture: { home_team: string; away_team: string; kickoff_utc: string };
    }>();
  if (!room) return { error: "not_found" as const };
  if (room.commentator_id !== userId && !admin) {
    return { error: "forbidden" as const };
  }
  return { room };
}

/** GET /api/recordings?room={id} — status, segments, signed downloads. */
export async function GET(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const roomId = request.nextUrl.searchParams.get("room");
  if (!roomId || !z.uuid().safeParse(roomId).success) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }

  const service = createServiceClient();
  const auth = await authorizeRoom(
    service,
    roomId,
    caller.userId,
    isAdmin(caller.userId, caller.profile),
  );
  if (auth.error === "not_found") {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (auth.error === "forbidden") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const { room } = auth;

  const { data: rec } = await service
    .from("recordings")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  if (!rec) {
    return NextResponse.json({ recording: null });
  }

  const fixtureLabel = `${room.fixture.home_team} vs ${room.fixture.away_team}`;
  const dateLabel = room.fixture.kickoff_utc.slice(0, 10);

  const files: {
    label: string;
    filename: string;
    url: string | null;
    durationSeconds: number | null;
    sizeBytes: number | null;
    markerId?: string;
  }[] = [];

  async function signed(path: string | null, filename: string): Promise<string | null> {
    if (!path) return null;
    const { data } = await service.storage
      .from(REC_BUCKET)
      .createSignedUrl(path, 60 * 60, { download: filename });
    return data?.signedUrl ?? null;
  }

  if (rec.status === "ready") {
    const fullName = recordingFileName(fixtureLabel, dateLabel);
    files.push({
      label: "Full broadcast",
      filename: fullName,
      url: await signed(rec.full_mp3_path, fullName),
      durationSeconds: rec.duration_seconds,
      sizeBytes: null,
    });

    const { data: segs } = await service
      .from("recording_segments")
      .select("idx, label, storage_path, size_bytes, duration_seconds")
      .eq("recording_id", rec.id)
      .order("idx", { ascending: true });
    for (const s of segs ?? []) {
      const name = recordingFileName(fixtureLabel, dateLabel, s.idx, s.label);
      files.push({
        label: s.label,
        filename: name,
        url: await signed(s.storage_path, name),
        durationSeconds: s.duration_seconds,
        sizeBytes: s.size_bytes,
      });
    }
  }

  const zipUrl =
    rec.status === "ready"
      ? await signed(
          rec.zip_path,
          `${brand.name} - ${fixtureLabel} - ${dateLabel}.zip`,
        )
      : null;

  // markers for the ±2min adjust UI
  const { data: markers } = await service
    .from("broadcast_markers")
    .select("id, kind, label, source, server_ts, adjusted_ts")
    .eq("room_id", roomId)
    .order("server_ts", { ascending: true });

  return NextResponse.json({
    recording: {
      status: rec.status,
      durationSeconds: rec.duration_seconds,
      error: rec.error,
    },
    files,
    zipUrl,
    markers: (markers ?? []).filter((m) => m.kind !== "broadcast_start" && m.kind !== "broadcast_end"),
    courtesyLine: `Recorded live on ${brand.name} during ${fixtureLabel}.`,
  });
}

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("process"), roomId: z.uuid() }),
  z.object({
    action: z.literal("adjust"),
    roomId: z.uuid(),
    markerId: z.uuid(),
    deltaSeconds: z.number().int().min(-120).max(120),
  }),
]);

/** POST — (re)process, or adjust a marker ±2min and recut (FR-13.3). */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;

  const service = createServiceClient();
  const auth = await authorizeRoom(
    service,
    body.roomId,
    caller.userId,
    isAdmin(caller.userId, caller.profile),
  );
  if (auth.error === "not_found") {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (auth.error === "forbidden") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  if (body.action === "adjust") {
    const { data: marker } = await service
      .from("broadcast_markers")
      .select("id, server_ts")
      .eq("id", body.markerId)
      .eq("room_id", body.roomId)
      .maybeSingle();
    if (!marker) {
      return NextResponse.json({ error: "Marker not found." }, { status: 404 });
    }
    // ±2 min ceiling enforced against the original server time (FR-13.3).
    // Setting the offset is cheap; the panel batches several nudges then
    // calls "process" once to recut.
    const clamped = Math.max(-120, Math.min(120, body.deltaSeconds));
    const adjusted =
      clamped === 0
        ? null
        : new Date(
            new Date(marker.server_ts).getTime() + clamped * 1000,
          ).toISOString();
    await service
      .from("broadcast_markers")
      .update({ adjusted_ts: adjusted })
      .eq("id", marker.id);
    return NextResponse.json({ ok: true });
  }

  // recut from the existing full MP3 / source
  const result = await processRecording(service, body.roomId);
  return NextResponse.json(result);
}
