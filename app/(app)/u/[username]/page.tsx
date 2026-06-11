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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle<Profile>();
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-raised text-2xl font-bold text-secondary"
        >
          {profile.username.slice(0, 1).toUpperCase()}
        </span>
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
