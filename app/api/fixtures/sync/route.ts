import { NextResponse } from "next/server";
import {
  createServiceClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import { syncFixtures } from "@/lib/fixtures";
import { isAdmin } from "@/lib/roles";

/** Admin-triggered fixtures sync. A scheduled trigger can come later. */
export async function POST() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!isAdmin(user?.id, profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const result = await syncFixtures(createServiceClient());
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 503 });
  }
  return NextResponse.json({ synced: result.count });
}
