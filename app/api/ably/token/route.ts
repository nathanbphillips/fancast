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

  // Anonymous listeners need a STABLE clientId: ably-js renews the token via
  // authUrl before the 1h TTL, and Ably rejects a renewal whose clientId
  // differs from the connection's — a fresh random id per request would drop
  // every anonymous listener mid-second-half (audit 2026-07-02). Persist one
  // in a long-lived cookie instead.
  let anonToSet: string | null = null;
  let clientId: string;
  if (user) {
    clientId = user.id;
  } else {
    const existing = request.cookies.get("fc_anon")?.value;
    if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) {
      clientId = `anon:${existing}`;
    } else {
      anonToSet = crypto.randomUUID();
      clientId = `anon:${anonToSet}`;
    }
  }

  const capability: Record<string, string[]> = {
    [channels.chat(roomId!)]: ["subscribe", "presence", "history"],
    [channels.links(roomId!)]: ["subscribe", "history"],
    [channels.control(roomId!)]: ["subscribe", "history"],
    // reactions are ephemeral + fire-and-forget; subscribe only, no history
    [channels.reactions(roomId!)]: ["subscribe"],
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

  const res = NextResponse.json(tokenRequest);
  if (anonToSet) {
    res.cookies.set("fc_anon", anonToSet, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
