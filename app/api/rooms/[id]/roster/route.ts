import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isRoomHost } from "@/lib/roomHosts";
import { ablyRest, channels } from "@/lib/ably";

/**
 * Host-only room roster (founder 2026-08-05: "let the host see who's in the
 * room"). Reads the Ably chat-channel presence set — the SAME set the header
 * listener count derives from — and resolves signed-in clientIds to profiles
 * SERVER-SIDE. Identity never rides the presence payload: every listener holds
 * 'presence' capability on the chat channel (see /api/ably/token), so a
 * client-side identity payload would leak a public attendee list, which the
 * golden-rule privacy stance forbids. Anonymous listeners (clientId "anon:*")
 * stay an aggregate count only. Host-gated (403 to non-hosts); presence read is
 * best-effort so a transport hiccup never 500s the host UI.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  const { id: roomId } = await params;
  if (!z.uuid().safeParse(roomId).success) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!(await isRoomHost(service, caller.userId, roomId))) {
    return NextResponse.json({ error: "Hosts only." }, { status: 403 });
  }

  // collect the current presence clientIds (paginated). Dedupe: one person in
  // two tabs shares a clientId, so a Set collapses them to one roster entry.
  const ids = new Set<string>();
  try {
    const channel = ablyRest().channels.get(channels.chat(roomId));
    let page = await channel.presence.get({ limit: 200 });
    for (const m of page.items) if (m.clientId) ids.add(m.clientId);
    while (page.hasNext()) {
      const next = await page.next();
      if (!next) break;
      page = next;
      for (const m of page.items) if (m.clientId) ids.add(m.clientId);
    }
  } catch (err) {
    console.error("roster presence read failed:", err);
    return NextResponse.json({ members: [], anonCount: 0, total: 0 });
  }

  // partition into signed-in user ids vs anonymous listeners
  const userIds: string[] = [];
  let anonCount = 0;
  for (const id of ids) {
    if (id.startsWith("anon:")) anonCount += 1;
    else userIds.push(id);
  }

  let members: {
    userId: string;
    username: string;
    avatarUrl: string | null;
  }[] = [];
  if (userIds.length > 0) {
    const { data } = await service
      .from("profiles")
      .select("user_id, username, avatar_url")
      .in("user_id", userIds);
    members = (data ?? []).map((p) => ({
      userId: p.user_id as string,
      username: p.username as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
    }));
    members.sort((a, b) => a.username.localeCompare(b.username));
  }

  return NextResponse.json({
    members,
    anonCount,
    total: members.length + anonCount,
  });
}
