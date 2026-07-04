import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type { Profile, RoomState, SocialPlatform } from "@/lib/db/types";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { isAdmin } from "@/lib/roles";
import { Avatar } from "@/components/Avatar";
import { AdminClearAvatar } from "@/components/AdminClearAvatar";
import { AdminSuspendCommentator } from "@/components/AdminSuspendCommentator";
import { AdminClearProfileText } from "@/components/AdminClearProfileText";
import { ReportProfile } from "@/components/ReportProfile";
import { FollowButton } from "@/components/FollowButton";
import { UsernameForm } from "@/components/UsernameForm";
import { KickoffTime } from "@/components/KickoffTime";

/**
 * Unified public profile at root /{username} (FR-18.3/18.4/18.5). One page per
 * person: the commentator sections (about, socials, upcoming rooms) layer onto
 * the base profile. Static routes always win over this dynamic segment, and
 * the reserved-username list guarantees no profile can shadow a future route.
 * The old /u/[username] URLs 301 here via next.config redirects.
 */

const UPCOMING_STATES: RoomState[] = [
  "scheduled",
  "waiting",
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

type UpcomingRoom = {
  id: string;
  slug: string | null;
  state: RoomState;
  scheduled_kickoff: string;
  fixture: { home_team: string; away_team: string; competition: string | null };
};

const SOCIAL_META: Record<SocialPlatform, { label: string; icon: string }> = {
  x: { label: "X", icon: "M4 4l7.2 9.3L4.4 20h2.2l5.6-5.5 4.3 5.5H20l-7.5-9.7L19.4 4h-2.2l-5 4.9L8.4 4z" },
  instagram: {
    label: "Instagram",
    icon: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM7 3.5h10A3.5 3.5 0 0120.5 7v10a3.5 3.5 0 01-3.5 3.5H7A3.5 3.5 0 013.5 17V7A3.5 3.5 0 017 3.5zm10.2 2.6a.9.9 0 100 1.8.9.9 0 000-1.8z",
  },
  youtube: {
    label: "YouTube",
    icon: "M21.6 7.2a2.6 2.6 0 00-1.8-1.9C18.2 5 12 5 12 5s-6.2 0-7.8.3A2.6 2.6 0 002.4 7.2 27 27 0 002 12a27 27 0 00.4 4.8 2.6 2.6 0 001.8 1.9c1.6.3 7.8.3 7.8.3s6.2 0 7.8-.3a2.6 2.6 0 001.8-1.9A27 27 0 0022 12a27 27 0 00-.4-4.8zM10 15V9l5.2 3z",
  },
  tiktok: {
    label: "TikTok",
    icon: "M16.5 3c.3 1.8 1.5 3.2 3.5 3.5v2.9c-1.3 0-2.5-.4-3.5-1.1v6.2a5.5 5.5 0 11-5.5-5.5c.3 0 .7 0 1 .1v3a2.5 2.5 0 101.7 2.4V3z",
  },
  twitch: {
    label: "Twitch",
    icon: "M4.5 3L3 6.8V19h4v2h2.5l2-2H15l4.5-4.5V3zm13.5 10.7L15.5 16H11l-2 2v-2H5.5V4.5H18zM14 7.5h1.5v4.5H14zm-4 0h1.5v4.5H10z",
  },
  website: {
    label: "Website",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20zm7 9h-3a15 15 0 00-1-5 8 8 0 014 5zm-7 9c-.9 0-2.3-2.2-2.9-6h5.8c-.6 3.8-2 6-2.9 6zm-3-8a17 17 0 010-4h6a17 17 0 010 4zm-4-1a8 8 0 01.1-2H8a17 17 0 000 4H5.1A8 8 0 015 12zm4-6a15 15 0 00-1 5H5a8 8 0 014-5zm7.9 12H15a15 15 0 001-5h3a8 8 0 01-4 5zM9 6a8 8 0 016 0c.4.9 1 2.5 1.2 5H7.8C8 8.5 8.6 6.9 9 6z",
  },
};

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
  // reserved names never resolve to profiles (they're future routes); the
  // migration guarantees no such profile exists, so skip the lookup entirely
  if (isReservedUsername(username)) notFound();

  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle<Profile>();
  // a transient DB error must not masquerade as "user not found" (recoverable
  // via the error boundary); only 404 when the user genuinely isn't there
  if (error) throw error;
  if (!profile) notFound();

  // admins hold every commentator capability (and host rooms), so the
  // commentator profile sections render for both; only listeners never see them
  const isCommentator = profile.role !== "listener";

  const [{ count: followerCount }, upcomingRes] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("commentator_id", profile.user_id),
    isCommentator
      ? supabase
          .from("rooms")
          .select(
            "id, slug, state, scheduled_kickoff, fixture:fixtures(home_team, away_team, competition)",
          )
          .eq("commentator_id", profile.user_id)
          .in("state", UPCOMING_STATES)
          .eq("postponed", false)
          .order("scheduled_kickoff", { ascending: true })
          .limit(10)
      : Promise.resolve({ data: null }),
  ]);
  const upcoming = (upcomingRes.data ?? []) as unknown as UpcomingRoom[];

  const { user: viewer, profile: viewerProfile } =
    await getCurrentUserAndProfile();
  const isOwn = viewer?.id === profile.user_id;

  let isFollowing = false;
  if (viewer && !isOwn && isCommentator) {
    const { data: follow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", viewer.id)
      .eq("commentator_id", profile.user_id)
      .maybeSingle();
    isFollowing = follow !== null;
  }

  const viewerIsAdmin = isAdmin(viewer?.id, viewerProfile);
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const socials = Object.entries(profile.social_links ?? {}).filter(
    ([platform, url]) => platform in SOCIAL_META && typeof url === "string" && url,
  ) as [SocialPlatform, string][];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* header: identity + follow */}
      <div className="flex items-center gap-4">
        <Avatar src={profile.avatar_url} name={profile.username} size={72} />
        <div className="min-w-0 flex-1">
          <h1
            className={`truncate text-2xl font-bold tracking-tight ${isCommentator ? "text-gold" : ""}`}
          >
            {profile.username}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
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
            <span>Member since {memberSince}</span>
            {/* FR-24 insertion point: fan score + matches attended render here */}
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
        {/* FR-23 insertion point: friend button renders here for listeners */}
      </div>

      {/* commentator sections (FR-18.5) */}
      {isCommentator && profile.about && (
        <p className="mt-6 text-[15px] leading-relaxed">{profile.about}</p>
      )}
      {isCommentator && socials.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          {socials.map(([platform, url]) => (
            <a
              key={platform}
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={SOCIAL_META[platform].label}
              title={SOCIAL_META[platform].label}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-secondary transition-colors hover:border-gold hover:text-primary"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
                <path d={SOCIAL_META[platform].icon} />
              </svg>
            </a>
          ))}
        </div>
      )}

      {isCommentator && upcoming.length > 0 && (
        <section aria-label="Upcoming rooms" className="mt-8">
          <h2 className="mb-2 font-mono text-[11px] font-bold tracking-[0.14em] text-secondary uppercase">
            Upcoming rooms
          </h2>
          <div className="overflow-hidden rounded-xl border-[0.75px] border-line bg-surface">
            {upcoming.map((r) => {
              const enterable = r.state !== "scheduled";
              const row = (
                <>
                  <span className="w-24 shrink-0 font-mono text-[10px] leading-snug tracking-wide text-secondary uppercase">
                    <KickoffTime iso={r.scheduled_kickoff} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold tracking-[-0.01em]">
                      {r.fixture.home_team} vs {r.fixture.away_team}
                    </span>
                    {r.fixture.competition && (
                      <span className="block truncate font-mono text-[10px] text-secondary uppercase">
                        {r.fixture.competition}
                      </span>
                    )}
                  </span>
                  {enterable ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-red px-2 py-1 font-mono text-[10px] tracking-wide text-white uppercase">
                      <span className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-white" aria-hidden="true" />
                      Live
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] tracking-wide text-secondary uppercase">
                      Scheduled
                    </span>
                  )}
                </>
              );
              return enterable ? (
                <Link
                  key={r.id}
                  href={`/room/${r.slug ?? r.id}`}
                  className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 hover:bg-raised"
                >
                  {row}
                </Link>
              ) : (
                <div
                  key={r.id}
                  className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0"
                >
                  {row}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FR-18.5 reserved stats region: a layout slot that renders NOTHING in
          v1. Future data (teams supported, bias meter, ratio) arrives as a
          quiet horizontal strip here without reflowing the page. */}
      {isCommentator && <div aria-hidden="true" data-reserved-stats />}

      {/* own-profile entries */}
      {isOwn && profile.role === "listener" && (
        <div className="mt-8 flex items-center justify-between gap-3 rounded-xl border-[0.75px] border-line bg-surface p-4">
          <div>
            <p className="text-sm font-bold">Become a commentator</p>
            <p className="mt-0.5 text-[13px] text-secondary">
              Host live rooms for matches. Set up takes a minute.
            </p>
          </div>
          <Link
            href="/settings"
            className="shrink-0 rounded-lg border border-gold px-4 py-2 text-sm font-semibold text-gold hover:bg-raised"
          >
            Get started
          </Link>
        </div>
      )}

      {isOwn && (
        <section
          aria-label="Account settings"
          className="mt-8 rounded-xl border-[0.75px] border-line bg-surface p-4"
        >
          <h2 className="mb-3 text-sm font-bold">Account</h2>
          <UsernameForm mode="change" currentUsername={profile.username} />
          <p className="mt-3 text-xs text-secondary">
            Photo{isCommentator ? ", about text, and social links" : ""} live in{" "}
            <Link href="/settings" className="underline hover:text-primary">
              settings
            </Link>
            .
          </p>
        </section>
      )}

      {/* report (FR-18.6): any signed-in viewer, never on your own profile */}
      {viewer && !isOwn && (
        <div className="mt-8">
          <ReportProfile userId={profile.user_id} />
        </div>
      )}

      {/* admin moderation */}
      {viewerIsAdmin && !isOwn && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {profile.avatar_url && <AdminClearAvatar userId={profile.user_id} />}
          {profile.about && (
            <AdminClearProfileText userId={profile.user_id} section="about" />
          )}
          {socials.length > 0 && (
            <AdminClearProfileText
              userId={profile.user_id}
              section="social_links"
            />
          )}
          {profile.role === "commentator" && (
            <AdminSuspendCommentator
              userId={profile.user_id}
              username={profile.username}
            />
          )}
        </div>
      )}
    </div>
  );
}
