import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { brand, recordingFileName } from "@/lib/brand";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { triggerProcessing } from "@/lib/recording";
import { ensureRecordingsPrivate } from "@/lib/egress";
import { isAdmin } from "@/lib/roles";

const REC_BUCKET = "recordings";

// a recut transcode can run for a few minutes
export const maxDuration = 300;

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

  // defense in depth (M-C): revert an accidental public-bucket toggle before
  // we hand out (signed) links to the room mix
  await ensureRecordingsPrivate(service);

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
    // all markers in lifecycle (server_ts) order so we can keep the
    // adjusted marker strictly between its neighbours — a boundary that
    // crosses another would scramble segment labels (derivation orders by
    // time but labels are intrinsic to marker kind)
    const { data: markers } = await service
      .from("broadcast_markers")
      .select("id, server_ts, adjusted_ts")
      .eq("room_id", body.roomId)
      .order("server_ts", { ascending: true });
    const idx = (markers ?? []).findIndex((m) => m.id === body.markerId);
    if (idx === -1) {
      return NextResponse.json({ error: "Marker not found." }, { status: 404 });
    }
    const marker = markers![idx];
    const eff = (m: { server_ts: string; adjusted_ts: string | null }) =>
      new Date(m.adjusted_ts ?? m.server_ts).getTime();
    const base = new Date(marker.server_ts).getTime();

    const { data: rec } = await service
      .from("recordings")
      .select("started_at, ended_at")
      .eq("room_id", body.roomId)
      .maybeSingle();

    // ±2 min ceiling (FR-13.3), then clamp into the open interval between
    // neighbours and inside the recording's own span
    const GAP = 250; // keep a small gap so boundaries never coincide
    let lo = base - 120_000;
    let hi = base + 120_000;
    if (idx > 0) lo = Math.max(lo, eff(markers![idx - 1]) + GAP);
    if (idx < markers!.length - 1) hi = Math.min(hi, eff(markers![idx + 1]) - GAP);
    if (rec?.started_at) lo = Math.max(lo, new Date(rec.started_at).getTime());
    if (rec?.ended_at) hi = Math.min(hi, new Date(rec.ended_at).getTime());

    const requested = base + body.deltaSeconds * 1000;
    const finalTs = Math.min(hi, Math.max(lo, requested));
    // within ~half a second of the original = no adjustment
    const adjusted =
      Math.abs(finalTs - base) < 500 ? null : new Date(finalTs).toISOString();
    await service
      .from("broadcast_markers")
      .update({ adjusted_ts: adjusted })
      .eq("id", marker.id);
    return NextResponse.json({ ok: true });
  }

  // recut asynchronously (atomic claim inside serializes concurrent runs);
  // the panel polls status to ready
  triggerProcessing(body.roomId);
  return NextResponse.json({ triggered: true });
}
