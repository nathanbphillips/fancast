import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ablyRest, channels } from "@/lib/ably";
import { createSupabaseServerClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import type { Profile } from "@/lib/db/types";

const roomIdSchema = z.uuid();

/**
 * Ably token requests, scoped to one room's public channels with
 * subscribe/presence/history only. Reading is open (FR-2.4), so anonymous
 * listeners get tokens too (clientId anon:*). The Phase 4 private channel
 * is deliberately NOT in this capability set.
 */
export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("room");
  if (!roomIdSchema.safeParse(roomId).success) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const clientId = user?.id ?? `anon:${crypto.randomUUID().slice(0, 8)}`;

  const capability: Record<string, string[]> = {
    [channels.chat(roomId!)]: ["subscribe", "presence", "history"],
    [channels.links(roomId!)]: ["subscribe", "history"],
    [channels.control(roomId!)]: ["subscribe", "history"],
  };

  if (user) {
    // each signed-in user may subscribe to their own per-user channel — how a
    // talk-request resolution reaches the requester without leaking their id on
    // the shared control channel (FR-4.2)
    capability[channels.userPrivate(roomId!, user.id)] = ["subscribe", "history"];

    // the room's commentator (and admins) may subscribe to the private
    // channel: questions + talk requests (FR-10.1, FR-4.2)
    const { data: room } = await supabase
      .from("rooms")
      .select("commentator_id")
      .eq("id", roomId!)
      .maybeSingle();
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Profile>();
    if (room?.commentator_id === user.id || isAdmin(user.id, profile)) {
      capability[channels.private(roomId!)] = ["subscribe", "history"];
    }
  }

  const tokenRequest = await ablyRest().auth.createTokenRequest({
    clientId,
    capability: JSON.stringify(capability),
    ttl: 60 * 60 * 1000, // 1h; ably-js renews via authUrl automatically
  });

  return NextResponse.json(tokenRequest);
}
