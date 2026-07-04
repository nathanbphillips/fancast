import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import { config } from "@/lib/config";
import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/lib/notify/types";
import { ProfileSettingsForm } from "@/components/ProfileSettingsForm";
import { CommentatorUpgrade } from "@/components/CommentatorUpgrade";
import {
  NotificationSettings,
  type PrefRow,
} from "@/components/NotificationSettings";

export const metadata: Metadata = { title: "Profile settings" };

export default async function SettingsPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/signin");
  if (!profile) redirect("/welcome");

  // Mirror the API's 30-day username lock so the form can explain the state.
  let usernameLocked = false;
  let unlocksOn: string | null = null;
  if (profile.username_changed_at) {
    const lockMs = config.usernameChangeLockDays * 24 * 60 * 60 * 1000;
    const unlocksAt = new Date(profile.username_changed_at).getTime() + lockMs;
    if (Date.now() < unlocksAt) {
      usernameLocked = true;
      unlocksOn = new Date(unlocksAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
      });
    }
  }

  const isCommentator = profile.role === "commentator";

  // notification prefs: stored deviations over the registry defaults (FR-21.2)
  const supabase = await createSupabaseServerClient();
  const { data: prefRows } = await supabase
    .from("notification_prefs")
    .select("type, email_enabled, push_enabled")
    .eq("user_id", user.id);
  const stored = new Map(
    (prefRows ?? []).map((r) => [
      r.type as string,
      { email: r.email_enabled as boolean, push: r.push_enabled as boolean },
    ]),
  );
  const prefs: PrefRow[] = (
    Object.keys(NOTIFICATION_TYPES) as NotificationType[]
  ).map((type) => {
    const meta = NOTIFICATION_TYPES[type];
    const s = stored.get(type);
    return {
      type,
      label: meta.label,
      description: meta.description,
      email: s ? s.email : meta.emailDefault,
      push: s ? s.push : meta.pushDefault,
    };
  });

  return (
    <div className="mx-auto max-w-xl px-5 py-14 sm:px-10">
      <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
        Your account
      </p>
      <h1 className="display text-4xl sm:text-5xl">Profile</h1>
      <p className="mt-3 text-secondary">
        Set the name and photo the room sees.
        {isCommentator
          ? " As a host, this is how listeners recognise you on air."
          : ""}
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <ProfileSettingsForm
          initialUsername={profile.username}
          initialAvatarUrl={profile.avatar_url}
          usernameLocked={usernameLocked}
          unlocksOn={unlocksOn}
          isCommentator={profile.role !== "listener"}
          initialAbout={profile.about}
          initialSocialLinks={profile.social_links}
        />
      </div>

      {/* Hosting (FR-18.1): self-serve commentator upgrade; commentators see
          their standing instead */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
        {profile.role === "listener" ? (
          <CommentatorUpgrade />
        ) : (
          <div>
            <p className="text-sm font-bold">
              {profile.role === "admin" ? "Admin account" : "Commentator account"}
            </p>
            <p className="mt-0.5 text-[13px] text-secondary">
              You can host rooms.
              {profile.commentator_terms_version
                ? ` Commentator terms accepted (version ${profile.commentator_terms_version}).`
                : ""}
            </p>
          </div>
        )}
      </div>

      {/* Notifications (FR-21.5): every type with its two toggles + push */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <p className="mb-1 text-sm font-bold">Notifications</p>
        <p className="mb-4 text-[13px] text-secondary">
          Choose what reaches you and how.
        </p>
        <NotificationSettings initial={prefs} />
      </div>

      <div className="mt-6">
        <Link
          href={`/${profile.username}`}
          className="text-sm text-secondary transition-colors hover:text-primary"
        >
          View your public profile →
        </Link>
      </div>
    </div>
  );
}
