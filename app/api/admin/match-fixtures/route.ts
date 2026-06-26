import { NextResponse, type NextRequest } from "next/server";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { matchPendingFixtures } from "@/lib/adminFixtures";

export const maxDuration = 60;

/**
 * Resolve pending admin fixtures to their Sportmonks fixture so the stats/info/
 * history panels light up (covered competitions only). Two ways in:
 *   GET  — a Vercel cron (daily), authenticated with Bearer CRON_SECRET.
 *   POST — the admin clicking "Run match check" (cookie auth).
 */
async function run() {
  const result = await matchPendingFixtures(createServiceClient());
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return run();
}

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  return run();
}
