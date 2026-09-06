import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { episodeNotes } from "@/lib/episodeNotes";
import { KIND_TO_LABEL, PODCAST_BUCKET, type EpisodeKind } from "@/lib/podcast";
import { isAdmin } from "@/lib/roles";

/**
 * Publish one of a room's shows to the podcast feed (founder 2026-09-01;
 * per-kind + scheduling 2026-09-06). Pre-game, the full-match blend, and
 * post-game are each their own episode: the MP3 is copied from the private
 * recordings bucket into the public `podcast` bucket and the episode row is
 * upserted; /podcast.xml serves it once its published_at has passed, so an
 * optional future `publishAt` is a scheduled release with no cron involved.
 * Republishing replaces audio + notes but keeps the guid, so directories
 * treat it as the same episode.
 *
 * Admin-only (the feed is one platform-branded channel and commentator
 * accounts are self-serve); recording rights stay 100% with the host, and
 * publishing is the founder's call until per-host feeds exist.
 */
const schema = z.object({
  roomId: z.uuid(),
  kind: z.enum(["pregame", "match", "postgame"]).default("postgame"),
  /** optional scheduled release; anything in the past means "now" */
  publishAt: z.iso.datetime().optional(),
});

export const maxDuration = 60;

const MAX_SCHEDULE_AHEAD_MS = 60 * 24 * 3600 * 1000; // 60 days

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomId, kind, publishAt } = parsed.data;
  if (publishAt && new Date(publishAt).getTime() > Date.now() + MAX_SCHEDULE_AHEAD_MS) {
    return NextResponse.json(
      { error: "Schedule at most 60 days ahead." },
      { status: 400 },
    );
  }
  const service = createServiceClient();

  const { data: room } = await service
    .from("rooms")
    .select(
      "id, commentator_id, kind, fixture:fixtures(home_team, away_team, kickoff_utc, home_score, away_score)",
    )
    .eq("id", roomId)
    .maybeSingle<{
      id: string;
      commentator_id: string;
      kind: string;
      fixture:
        | { home_team: string; away_team: string; kickoff_utc: string; home_score: number | null; away_score: number | null }
        | { home_team: string; away_team: string; kickoff_utc: string; home_score: number | null; away_score: number | null }[]
        | null;
    }>();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  // The feed is ONE platform-branded channel and commentator accounts are
  // self-serve: any host could otherwise place arbitrary audio on the
  // Arseradio podcast. Admin-gated until per-host feeds exist (Assumed
  // 2026-09-01); an admin may publish any room's show.
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json(
      { error: "Publishing to the podcast feed is admin-only for now." },
      { status: 403 },
    );
  }
  const fxRaw = room.fixture;
  const fx = Array.isArray(fxRaw) ? fxRaw[0] : fxRaw;
  if (!fx) {
    return NextResponse.json(
      { error: "Only match rooms have shows to publish." },
      { status: 400 },
    );
  }

  const { data: rec } = await service
    .from("recordings")
    .select("id, status")
    .eq("room_id", roomId)
    .maybeSingle<{ id: string; status: string }>();
  if (!rec || !["ready", "damaged"].includes(rec.status)) {
    return NextResponse.json(
      { error: "The recording is not ready yet." },
      { status: 409 },
    );
  }

  // the cut this kind publishes; longest wins defensively (legacy rooms can
  // carry pre-recut slivers with the same label)
  const label = KIND_TO_LABEL[kind as EpisodeKind];
  const { data: segs } = await service
    .from("recording_segments")
    .select("storage_path, duration_seconds, label")
    .eq("recording_id", rec.id)
    .eq("label", label)
    .order("duration_seconds", { ascending: false })
    .limit(1);
  const seg = segs?.[0];
  if (!seg) {
    return NextResponse.json(
      { error: `This recording has no ${label} file.` },
      { status: 409 },
    );
  }
  if (Number(seg.duration_seconds) < 60) {
    return NextResponse.json(
      {
        error: `The ${label} file is under a minute long. Recut the recording first (nudge any boundary and apply), then publish.`,
      },
      { status: 409 },
    );
  }

  const { data: blob, error: dlErr } = await service.storage
    .from("recordings")
    .download(seg.storage_path);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: `Could not read the ${label} file: ${dlErr?.message ?? "missing"}` },
      { status: 500 },
    );
  }
  const bytes = Buffer.from(await blob.arrayBuffer());
  const audioPath = `episodes/${roomId}-${kind}.mp3`;
  const { error: upErr } = await service.storage
    .from(PODCAST_BUCKET)
    .upload(audioPath, bytes, { contentType: "audio/mpeg", upsert: true });
  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  // notes come from the same generator the recordings page shows
  const notes = episodeNotes({
    homeTeam: fx.home_team,
    awayTeam: fx.away_team,
    kickoffIso: fx.kickoff_utc,
    homeScore: fx.home_score,
    awayScore: fx.away_score,
  })[kind as EpisodeKind];

  // one episode per (room, kind): a republish refreshes audio + notes and
  // keeps the guid; published_at moves only when a new schedule is given
  const { data: existing } = await service
    .from("podcast_episodes")
    .select("id, published_at")
    .eq("room_id", roomId)
    .eq("kind", kind)
    .maybeSingle();
  const publishedAt = publishAt ?? existing?.published_at ?? new Date().toISOString();
  const row = {
    room_id: roomId,
    kind,
    title: notes.title,
    description: notes.description,
    audio_path: audioPath,
    audio_bytes: bytes.length,
    duration_seconds: seg.duration_seconds,
    published_at: publishedAt,
    created_by: caller.userId,
  };
  const write = await service
    .from("podcast_episodes")
    .upsert(row, { onConflict: "room_id,kind" });
  if (write.error) {
    return NextResponse.json({ error: write.error.message }, { status: 500 });
  }
  return NextResponse.json({
    published: true,
    kind,
    publishedAt,
    scheduled: new Date(publishedAt).getTime() > Date.now(),
    republished: !!existing,
  });
}

/** Remove an episode from the feed: deletes the public audio and the row.
 *  Admin-gated like publish. Directories drop the item on their next poll. */
export async function DELETE(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const service = createServiceClient();
  const { data: episode } = await service
    .from("podcast_episodes")
    .select("id, audio_path")
    .eq("room_id", parsed.data.roomId)
    .eq("kind", parsed.data.kind)
    .maybeSingle();
  if (!episode) return NextResponse.json({ error: "Not on the feed." }, { status: 404 });
  const { error: rmErr } = await service.storage.from(PODCAST_BUCKET).remove([episode.audio_path]);
  if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 502 });
  const { error: delErr } = await service.from("podcast_episodes").delete().eq("id", episode.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
