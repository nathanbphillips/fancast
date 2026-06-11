import { NextResponse } from "next/server";
import {
  createServiceClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type { Profile } from "@/lib/db/types";

/**
 * Shared guard for write routes: caller must be signed in with a profile
 * and not banned. Returns the error response to send, or the caller.
 */
export async function requireParticipant(): Promise<
  | { error: NextResponse }
  | { error: null; userId: string; profile: Profile }
> {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user || !profile) {
    return {
      error: NextResponse.json({ error: "Sign in first." }, { status: 401 }),
    };
  }

  const service = createServiceClient();
  const { data: ban } = await service
    .from("bans")
    .select("expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (ban && (ban.expires_at === null || new Date(ban.expires_at) > new Date())) {
    return {
      error: NextResponse.json(
        { error: "Your account is banned." },
        { status: 403 },
      ),
    };
  }

  return { error: null, userId: user.id, profile };
}
