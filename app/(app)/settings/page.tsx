import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { config } from "@/lib/config";
import { ProfileSettingsForm } from "@/components/ProfileSettingsForm";

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
        />
      </div>

      <div className="mt-6">
        <Link
          href={`/u/${profile.username}`}
          className="text-sm text-secondary transition-colors hover:text-primary"
        >
          View your public profile →
        </Link>
      </div>
    </div>
  );
}
