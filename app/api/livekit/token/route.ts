import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createServiceClient,
  createSupabaseServerClient,
} from "@/lib/db/server";
import { mintToken } from "@/lib/livekit";
import { isAdmin } from "@/lib/roles";
import type { Profile, RoomState } from "@/lib/db/types";

const AUDIO_STATES: RoomState[] = [
  "waiting",
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

/**
 * LiveKit join tokens, role-scoped (FR-4.1):
 *  - room commentator: publish (mic only) + subscribe
 *  - accepted on-air guest (pending completion): publish + subscribe
 *  - everyone else incl. anonymous: subscribe only
 * Reading is open (FR-2.4), so anonymous listeners get tokens too.
 */
export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("room");
  if (!z.uuid().safeParse(roomId).success) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("id, state, commentator_id")
    .eq("id", roomId!)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (!AUDIO_STATES.includes(room.state as RoomState)) {
    return NextResponse.json(
      { error: "This room isn't live." },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let identity = `anon:${crypto.randomUUID().slice(0, 8)}`;
  let name = "guest";
  let canPublish = false;

  if (user) {
    identity = user.id;
    const { data: profile } = await service
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Profile>();
    name = profile?.username ?? "guest";

    // A banned user gets no token at all — not even subscribe (M-1, audit).
    // Mirrors requireParticipant's active-ban predicate; the service client is
    // required because bans RLS grants SELECT to admins only.
    const { data: ban } = await service
      .from("bans")
      .select("expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ban && (ban.expires_at === null || new Date(ban.expires_at) > new Date())) {
      return NextResponse.json({ error: "Your account is banned." }, { status: 403 });
    }

    if (user.id === room.commentator_id || isAdmin(user.id, profile)) {
      canPublish = true;
    } else {
      const { data: accepted } = await service
        .from("talk_requests")
        .select("id")
        .eq("room_id", room.id)
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .maybeSingle();
      canPublish = accepted !== null;
    }
  }

  const token = await mintToken({
    roomId: room.id,
    identity,
    name,
    canPublish,
  });

  return NextResponse.json({
    token,
    url: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_URL,
    canPublish,
  });
}
