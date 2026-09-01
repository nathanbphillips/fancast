import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { episodeNotes } from "@/lib/episodeNotes";
import { PODCAST_BUCKET } from "@/lib/podcast";
import { isAdmin } from "@/lib/roles";

/**
 * Publish a room's post-game show to the podcast feed (founder 2026-09-01).
 * Copies the post-game MP3 from the private recordings bucket into the public
 * `podcast` bucket and upserts the episode row; /podcast.xml carries it from
 * that moment and the directories (Spotify etc.) ingest it on their next
 * poll. Republishing after a recut replaces the audio but keeps the guid and
 * publish date, so directories treat it as the same episode.
 *
 * Admin-only (the feed is one platform-branded channel and commentator
 * accounts are self-serve); recording rights stay 100% with the host, and
 * publishing is the founder's call until per-host feeds exist.
 */
const schema = z.object({ roomId: z.uuid() });

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomId } = parsed.data;
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
      { error: "Only match rooms have a post-game show to publish." },
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

  // the post-game cut; longest wins defensively (legacy rooms can carry
  // pre-ET slivers with the same label)
  const { data: segs } = await service
    .from("recording_segments")
    .select("storage_path, duration_seconds, label")
    .eq("recording_id", rec.id)
    .eq("label", "Post-game show")
    .order("duration_seconds", { ascending: false })
    .limit(1);
  const seg = segs?.[0];
  if (!seg) {
    return NextResponse.json(
      { error: "This recording has no post-game show file." },
      { status: 409 },
    );
  }
  if (Number(seg.duration_seconds) < 60) {
    return NextResponse.json(
      {
        error:
          "The post-game show file is under a minute long. This recording was cut before extra time was retired: recut it (nudge any boundary and apply), then publish.",
      },
      { status: 409 },
    );
  }

  const { data: blob, error: dlErr } = await service.storage
    .from("recordings")
    .download(seg.storage_path);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: `Could not read the post-game file: ${dlErr?.message ?? "missing"}` },
      { status: 500 },
    );
  }
  const bytes = Buffer.from(await blob.arrayBuffer());
  const audioPath = `episodes/${roomId}.mp3`;
  const { error: upErr } = await service.storage
    .from(PODCAST_BUCKET)
    .upload(audioPath, bytes, { contentType: "audio/mpeg", upsert: true });
  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  // notes come from the same generator the recordings page shows
  const { data: hostRows } = await service
    .from("room_hosts")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("status", "accepted");
  const ids = (hostRows ?? []).map((h) => h.user_id);
  const { data: profs } = ids.length
    ? await service.from("profiles").select("username").in("user_id", ids)
    : { data: [] as { username: string }[] };
  const notes = episodeNotes({
    homeTeam: fx.home_team,
    awayTeam: fx.away_team,
    kickoffIso: fx.kickoff_utc,
    homeScore: fx.home_score,
    awayScore: fx.away_score,
    hosts: (profs ?? []).map((p) => p.username),
  }).postgame;

  // one episode per room: a republish refreshes audio + notes, keeps identity
  const { data: existing } = await service
    .from("podcast_episodes")
    .select("id, guid, published_at")
    .eq("room_id", roomId)
    .maybeSingle();
  const row = {
    room_id: roomId,
    title: notes.title,
    description: notes.description,
    audio_path: audioPath,
    audio_bytes: bytes.length,
    duration_seconds: seg.duration_seconds,
    created_by: caller.userId,
  };
  // upsert on room_id: two simultaneous clicks converge on one row (guid and
  // published_at are absent from the payload, so the conflict-update path
  // leaves them untouched and a republish keeps the episode's identity)
  const write = await service
    .from("podcast_episodes")
    .upsert(row, { onConflict: "room_id" });
  if (write.error) {
    return NextResponse.json({ error: write.error.message }, { status: 500 });
  }
  const { data: after } = await service
    .from("podcast_episodes")
    .select("published_at")
    .eq("room_id", roomId)
    .single();
  return NextResponse.json({
    published: true,
    publishedAt: after?.published_at ?? new Date().toISOString(),
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
    .maybeSingle();
  if (!episode) return NextResponse.json({ error: "Not on the feed." }, { status: 404 });
  const { error: rmErr } = await service.storage.from(PODCAST_BUCKET).remove([episode.audio_path]);
  if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 502 });
  const { error: delErr } = await service.from("podcast_episodes").delete().eq("id", episode.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
