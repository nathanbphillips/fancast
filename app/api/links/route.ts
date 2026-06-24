import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import type { Link } from "@/lib/db/types";
import { rateLimit } from "@/lib/ratelimit";
import { isFetchableUrl, unfurl } from "@/lib/unfurl";

const bodySchema = z.object({
  roomId: z.uuid(),
  url: z.string().trim().max(2000),
});

function normalizeDomain(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/** Submit a link (FR-9.1): blocklist check → unfurl → card. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  // each submit triggers an outbound unfurl fetch, so cap per user to blunt
  // hammering the unfurler (SSRF amplification / scanning). Generous for a real
  // user who posts a handful of links.
  if (!rateLimit(`link:${caller.userId}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "You're posting links too fast — give it a moment." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(parsed.data.url);
  } catch {
    return NextResponse.json(
      { error: "That doesn't look like a link." },
      { status: 400 },
    );
  }
  if (!isFetchableUrl(url)) {
    return NextResponse.json(
      { error: "Only regular web links are allowed." },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  const { data: room } = await service
    .from("rooms")
    .select("id, state, commentator_id, links_open")
    .eq("id", parsed.data.roomId)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (room.state === "wrapped") {
    return NextResponse.json(
      { error: "This room has ended." },
      { status: 403 },
    );
  }
  // links unlock at Start Broadcast (FR-3.3); the commentator may seed
  // earlier, or open links to everyone early (founder decision 2026-06-11)
  if (
    (room.state === "waiting" || room.state === "scheduled") &&
    !(room.state === "waiting" && room.links_open) &&
    room.commentator_id !== caller.userId
  ) {
    return NextResponse.json(
      { error: "Links open when the broadcast starts." },
      { status: 403 },
    );
  }

  // blocklist (FR-9.3): exact domain or any parent domain
  const domain = normalizeDomain(url.hostname);
  const candidates = domain
    .split(".")
    .map((_, i, parts) => parts.slice(i).join("."))
    .filter((d) => d.includes("."));
  const { data: blocked } = await service
    .from("blocklist_domains")
    .select("domain")
    .in("domain", candidates)
    .limit(1);
  if (blocked && blocked.length > 0) {
    return NextResponse.json(
      {
        error:
          "Links to that site aren't allowed here — see the community guidelines (no piracy, no unsafe downloads).",
      },
      { status: 422 },
    );
  }

  const og = await unfurl(url);

  const { data: link, error } = await service
    .from("links")
    .insert({
      room_id: room.id,
      user_id: caller.userId,
      url: url.toString(),
      og_title: og.title,
      og_description: og.description,
      og_image: og.image,
      domain,
    })
    .select("*, author:profiles!links_user_id_fkey(username, role)")
    .single<Link>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await publish(channels.links(room.id), "link", link);
  return NextResponse.json({ link }, { status: 201 });
}
