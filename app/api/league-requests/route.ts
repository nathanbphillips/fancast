import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { rateLimit } from "@/lib/ratelimit";

/**
 * League requests (founder 2026-07-06): a free-text "which league should we add
 * next?" box on the create-room page. Free text on purpose (a dropdown across
 * every sport would be overwhelming); rows land in league_requests (migration
 * 0037, service-role only) and are triaged by hand. Signed-in users only,
 * rate-limited per user.
 */
const schema = z.object({
  league: z.string().trim().min(2).max(80),
});

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  if (!rateLimit(`leaguereq:${caller.userId}`, 5, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "That's plenty of requests for today. Thank you!" },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Tell us the league or competition name." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { error } = await service.from("league_requests").insert({
    user_id: caller.userId,
    league: parsed.data.league,
  });
  if (error) {
    return NextResponse.json(
      { error: "Couldn't save that. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
