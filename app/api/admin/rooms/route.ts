import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { config } from "@/lib/config";
import type { Room } from "@/lib/db/types";

const bodySchema = z.object({
  homeTeam: z.string().trim().min(1).max(40),
  awayTeam: z.string().trim().min(1).max(40),
  kickoffUtc: z.iso.datetime(),
});

/**
 * Admin-only: create a room for ANY game (World Cup, friendly, etc.) from just
 * team names + kickoff. Builds an "admin" fixture (synthetic id, no Sportmonks
 * id yet — the daily matcher fills it for covered competitions) and a waiting
 * room with the admin as commentator. Deliberately tight: only the two team
 * names + kickoff; the room title is strictly "Home vs Away" and every other
 * room capability is the standard one — no custom titles or structural knobs.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter both team names and a kickoff time." },
      { status: 400 },
    );
  }
  const { homeTeam, awayTeam, kickoffUtc } = parsed.data;

  const service = createServiceClient();
  // synthetic id: epoch ms is far above any real Sportmonks fixture id (~tens of
  // millions), so it can never collide with a synced row or a future match
  const fixtureId = Date.now();
  const { error: fxErr } = await service.from("fixtures").insert({
    id: fixtureId,
    source: "admin",
    competition: "Match",
    home_team: homeTeam,
    away_team: awayTeam,
    season: config.season,
    kickoff_utc: kickoffUtc,
  });
  if (fxErr) {
    return NextResponse.json({ error: fxErr.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: room, error: roomErr } = await service
    .from("rooms")
    .insert({
      fixture_id: fixtureId,
      commentator_id: caller.userId,
      state: "waiting",
      opened_at: now,
      scheduled_kickoff: kickoffUtc,
    })
    .select()
    .single<Room>();
  if (roomErr || !room) {
    await service.from("fixtures").delete().eq("id", fixtureId); // no orphan
    return NextResponse.json(
      { error: roomErr?.message ?? "Couldn't create the room." },
      { status: 500 },
    );
  }

  return NextResponse.json({ roomId: room.id }, { status: 201 });
}
