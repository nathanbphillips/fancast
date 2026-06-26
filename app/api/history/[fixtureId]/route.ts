import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { emptyHistory, getMatchHistory } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/db/server";

export const maxDuration = 30;

/**
 * Public pre-game history proxy (reading is open, FR-2.4): each team's league
 * standing + last-5 form. Same guards as the stats proxy — only a positive
 * integer fixtureId present in our synced `fixtures` table reaches Sportmonks;
 * the team ids come from that row (never the client). Cached long (lib/history)
 * since standings change slowly. Seed/unknown id → empty contract, no call.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  const parsed = z.coerce.number().int().safeParse(fixtureId);
  const id = parsed.success ? parsed.data : 0;
  if (!parsed.success || id <= 0) {
    return NextResponse.json(emptyHistory, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  const supabase = await createSupabaseServerClient();
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("id, home_team_id, away_team_id")
    .eq("id", id)
    .maybeSingle<{ id: number; home_team_id: number | null; away_team_id: number | null }>();
  if (!fixture) {
    return NextResponse.json(emptyHistory, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const history = await getMatchHistory(
      id,
      fixture.home_team_id,
      fixture.away_team_id,
    );
    return NextResponse.json(history, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 });
  }
}
