import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { emptyStats, getFixtureStats } from "@/lib/stats";
import { createSupabaseServerClient } from "@/lib/db/server";

export const maxDuration = 30;

/**
 * Public match-stats proxy (reading is open, FR-2.4). Only a positive integer
 * fixtureId is accepted; the Sportmonks include set + base are hardcoded
 * server-side (no client-supplied URL — SSRF guard). A seed/dev fixture
 * (id <= 0) or an invalid id returns the zeros contract with NO upstream call,
 * so dev rooms render the pre-match placeholder instead of erroring.
 *
 * Allowlist (audit M-B): only ids present in our synced `fixtures` table reach
 * Sportmonks. Rooms can only point at known fixtures (FK), so legitimate
 * polling is unaffected, but an unauthenticated id-enumeration can't bypass the
 * per-id cache to amplify calls against the metered Sportmonks plan.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  const parsed = z.coerce.number().int().safeParse(fixtureId);
  const id = parsed.success ? parsed.data : 0;
  if (!parsed.success || id <= 0) {
    return NextResponse.json(emptyStats(id), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  // unknown fixture, or an admin game not yet matched to a Sportmonks fixture →
  // zeros contract, NO upstream call (the room shows "Information coming soon").
  const supabase = await createSupabaseServerClient();
  const { data: known } = await supabase
    .from("fixtures")
    .select("id, sportmonks_fixture_id")
    .eq("id", id)
    .maybeSingle<{ id: number; sportmonks_fixture_id: number | null }>();
  if (!known || known.sportmonks_fixture_id == null) {
    return NextResponse.json(emptyStats(id), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const stats = await getFixtureStats(known.sportmonks_fixture_id);
    return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // match data is non-critical — fail soft with a 503 the client treats calmly
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 503 },
    );
  }
}
