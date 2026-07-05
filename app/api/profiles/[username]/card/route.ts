import { NextResponse, type NextRequest } from "next/server";
import {
  createServiceClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import { friendState, hasBlocked } from "@/lib/friends";

/**
 * Profile popover payload (FR-26): everything a popover renders in one call,
 * including viewer-specific follow + friend state. Reading is open (anonymous
 * viewers get the profile with follow/friend state "none"). No raw sensitive
 * data: about is truncated, counts are aggregates.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const service = createServiceClient();

  const { data: profile } = await service
    .from("profiles")
    .select("user_id, username, role, avatar_url, about")
    .eq("username", username)
    .maybeSingle<{
      user_id: string;
      username: string;
      role: string;
      avatar_url: string | null;
      about: string | null;
    }>();
  if (!profile) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const isHost = profile.role !== "listener";

  const [{ count: followers }, { data: stats }] = await Promise.all([
    service
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("commentator_id", profile.user_id),
    service
      .from("profile_stats")
      .select("fan_score, matches_attended")
      .eq("user_id", profile.user_id)
      .maybeSingle<{ fan_score: number; matches_attended: number }>(),
  ]);

  // viewer-specific state
  const { user } = await getCurrentUserAndProfile();
  let following = false;
  let friend = "none";
  let blocked = false;
  const isSelf = user?.id === profile.user_id;
  if (user && !isSelf) {
    const [{ data: follow }, fState, blk] = await Promise.all([
      service
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("commentator_id", profile.user_id)
        .maybeSingle(),
      friendState(service, user.id, profile.user_id),
      hasBlocked(service, user.id, profile.user_id),
    ]);
    following = follow !== null;
    friend = fState;
    blocked = blk;
  }

  return NextResponse.json({
    userId: profile.user_id,
    username: profile.username,
    avatarUrl: profile.avatar_url,
    aboutSnippet: isHost && profile.about ? profile.about.slice(0, 100) : null,
    isHost,
    followerCount: followers ?? 0,
    fanScore: stats?.fan_score ?? 0,
    matchesAttended: stats?.matches_attended ?? 0,
    isSelf,
    signedIn: !!user,
    following,
    friend,
    blocked,
  });
}
