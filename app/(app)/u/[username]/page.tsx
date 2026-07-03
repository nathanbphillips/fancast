import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type { Profile } from "@/lib/db/types";
import { FollowButton } from "@/components/FollowButton";
import { UsernameForm } from "@/components/UsernameForm";
import { Avatar } from "@/components/Avatar";
import { AdminClearAvatar } from "@/components/AdminClearAvatar";
import { isAdmin } from "@/lib/roles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: username };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle<Profile>();
  // a transient DB error must not masquerade as "user not found" — let the error
  // boundary handle it (recoverable); only 404 when the user genuinely isn't there
  if (error) throw error;
  if (!profile) notFound();

  const { count: followerCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("commentator_id", profile.user_id);

  const { user: viewer, profile: viewerProfile } =
    await getCurrentUserAndProfile();
  const isOwn = viewer?.id === profile.user_id;

  let isFollowing = false;
  if (viewer && !isOwn && profile.role === "commentator") {
    const { data: follow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", viewer.id)
      .eq("commentator_id", profile.user_id)
      .maybeSingle();
    isFollowing = follow !== null;
  }

  const isCommentator = profile.role === "commentator";
  const viewerIsAdmin = isAdmin(viewer?.id, viewerProfile);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-4">
        <Avatar src={profile.avatar_url} name={profile.username} size={64} />
        <div className="min-w-0 flex-1">
          <h1
            className={`truncate text-2xl font-bold tracking-tight ${isCommentator ? "text-gold" : ""}`}
          >
            {profile.username}
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-secondary">
            {isCommentator && (
              <span className="rounded-sm bg-gold px-1.5 py-0.5 text-[10px] font-bold text-canvas">
                COMMENTATOR
              </span>
            )}
            {isCommentator && (
              <span className="tabular-nums">
                {followerCount ?? 0}{" "}
                {followerCount === 1 ? "follower" : "followers"}
              </span>
            )}
          </p>
        </div>
        {isCommentator && !isOwn && (
          <div className="shrink-0">
            {viewerProfile ? (
              <FollowButton
                commentatorId={profile.user_id}
                initialFollowing={isFollowing}
              />
            ) : (
              <Link
                href="/signin"
                className="flex h-11 items-center rounded-lg border border-line bg-surface px-5 text-sm font-semibold hover:bg-raised"
              >
                Sign in to follow
              </Link>
            )}
          </div>
        )}
      </div>

      {viewerIsAdmin && !isOwn && profile.avatar_url && (
        <div className="mt-4">
          <AdminClearAvatar userId={profile.user_id} />
        </div>
      )}

      {isOwn && (
        <section
          aria-label="Account settings"
          className="mt-8 rounded-xl border-[0.75px] border-line bg-surface p-4"
        >
          <h2 className="mb-3 text-sm font-bold">Account</h2>
          <UsernameForm mode="change" currentUsername={profile.username} />
        </section>
      )}
    </div>
  );
}
