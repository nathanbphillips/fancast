import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { emptyStats, getFixtureStats } from "@/lib/stats";

export const maxDuration = 30;

/**
 * Public match-stats proxy (reading is open, FR-2.4). Only a positive integer
 * fixtureId is accepted; the Sportmonks include set + base are hardcoded
 * server-side (no client-supplied URL — SSRF guard). A seed/dev fixture
 * (id <= 0) or an invalid id returns the zeros contract with NO upstream call,
 * so dev rooms render the pre-match placeholder instead of erroring.
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
  try {
    const stats = await getFixtureStats(id);
    return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // match data is non-critical — fail soft with a 503 the client treats calmly
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 503 },
    );
  }
}
