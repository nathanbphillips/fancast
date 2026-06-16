import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { callerFlagSummary } from "@/lib/callers";
import {
  createServiceClient,
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type { Question, TalkRequest } from "@/lib/db/types";
import { isAdmin } from "@/lib/roles";

/**
 * Read-only reconcilable snapshot of a room (M-4, audit). After an Ably
 * reconnect, clients fetch this to rebuild the state the realtime layer may
 * have missed (golden rule 5: reconstruct from the DB). Mirrors the
 * server-side slice the room page computes; never writes or publishes.
 * Moderator-only fields (questions, pending talk requests) are returned only
 * to the room commentator / admin.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("state, broadcast_start, chat_open, links_open, hls_url, commentator_id")
    .eq("id", id)
    .maybeSingle<{
      state: string;
      broadcast_start: string | null;
      chat_open: boolean;
      links_open: boolean;
      hls_url: string | null;
      commentator_id: string;
    }>();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const service = createServiceClient();
  const [{ data: clockEvents }, { data: sliderRows }] = await Promise.all([
    supabase
      .from("clock_events")
      .select("action, server_ts, offset_seconds")
      .eq("room_id", id)
      .order("server_ts", { ascending: true }),
    service.from("slider_votes").select("value").eq("room_id", id),
  ]);
  const sliderCount = sliderRows?.length ?? 0;
  const sliderAgg = {
    avg:
      sliderCount === 0
        ? 50
        : Math.round(sliderRows!.reduce((s, v) => s + v.value, 0) / sliderCount),
    count: sliderCount,
  };

  const { user, profile } = await getCurrentUserAndProfile();
  const isModerator =
    !!user && (user.id === room.commentator_id || isAdmin(user.id, profile));

  let questions: Question[] = [];
  let talkRequests: TalkRequest[] = [];
  if (isModerator) {
    const [{ data: qs }, { data: trs }] = await Promise.all([
      service
        .from("questions")
        .select("*, author:profiles!questions_user_id_fkey(username, role)")
        .eq("room_id", id)
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<Question[]>(),
      service
        .from("talk_requests")
        .select("*, author:profiles!talk_requests_user_id_fkey(username, role)")
        .eq("room_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .returns<TalkRequest[]>(),
    ]);
    questions = qs ?? [];
    talkRequests = await Promise.all(
      (trs ?? []).map(async (tr) => ({
        ...tr,
        caller_flags: await callerFlagSummary(service, tr.user_id),
      })),
    );
  }

  return NextResponse.json({
    state: room.state,
    sliderAgg,
    broadcastStart: room.broadcast_start,
    chatOpen: room.chat_open,
    linksOpen: room.links_open,
    hlsUrl: room.hls_url,
    clockEvents: clockEvents ?? [],
    questions,
    talkRequests,
  });
}
