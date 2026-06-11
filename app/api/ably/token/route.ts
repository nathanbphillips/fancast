import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ablyRest, channels } from "@/lib/ably";
import { createSupabaseServerClient } from "@/lib/db/server";

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

  const tokenRequest = await ablyRest().auth.createTokenRequest({
    clientId,
    capability: JSON.stringify(capability),
    ttl: 60 * 60 * 1000, // 1h; ably-js renews via authUrl automatically
  });

  return NextResponse.json(tokenRequest);
}
