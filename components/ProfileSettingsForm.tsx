"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import type { SocialPlatform } from "@/lib/db/types";

/**
 * Profile editor: the name + photo a room sees, plus the commentator sections
 * (about + social links, FR-18.5) when the account can host. Photo is a
 * free-text https image URL for the MVP (no upload bucket yet); PATCH
 * /api/profile persists everything. Username keeps its 30-day change lock
 * (enforced server-side).
 */
const SOCIAL_FIELDS: { key: SocialPlatform; label: string; placeholder: string }[] = [
  { key: "bluesky", label: "Bluesky", placeholder: "https://bsky.app/profile/yourhandle" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourhandle" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourchannel" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourhandle" },
  { key: "twitch", label: "Twitch", placeholder: "https://twitch.tv/yourchannel" },
  { key: "website", label: "Website", placeholder: "https://yoursite.com" },
  { key: "x", label: "X", placeholder: "https://x.com/yourhandle" },
];

export function ProfileSettingsForm({
  initialUsername,
  initialAvatarUrl,
  usernameLocked,
  unlocksOn,
  isCommentator = false,
  initialAbout = null,
  initialSocialLinks = null,
}: {
  initialUsername: string;
  initialAvatarUrl: string | null;
  usernameLocked: boolean;
  unlocksOn: string | null;
  isCommentator?: boolean;
  initialAbout?: string | null;
  initialSocialLinks?: Partial<Record<SocialPlatform, string>> | null;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [about, setAbout] = useState(initialAbout ?? "");
  const [socials, setSocials] = useState<Record<SocialPlatform, string>>({
    bluesky: initialSocialLinks?.bluesky ?? "",
    instagram: initialSocialLinks?.instagram ?? "",
    youtube: initialSocialLinks?.youtube ?? "",
    tiktok: initialSocialLinks?.tiktok ?? "",
    twitch: initialSocialLinks?.twitch ?? "",
    website: initialSocialLinks?.website ?? "",
    x: initialSocialLinks?.x ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    // the photo is managed by its own upload endpoint, not this form save
    const body: Record<string, unknown> = {};
    if (username.trim().toLowerCase() !== initialUsername.toLowerCase()) {
      body.username = username.trim();
    }
    if (isCommentator) {
      body.about = about.trim();
      body.social_links = Object.fromEntries(
        Object.entries(socials).map(([k, v]) => [k, v.trim()]),
      );
    }
    if (Object.keys(body).length === 0) {
      setBusy(false);
      setSaved(true); // nothing to change; the photo saves on upload
      return;
    }
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Couldn't save. Try again.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // let the same file be re-picked after a failure
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: data,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError(json.error ?? "Couldn't upload that image.");
        return;
      }
      setAvatarUrl(json.avatarUrl ?? "");
      router.refresh();
    } catch {
      setAvatarError("Couldn't upload that image.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setAvatarError(json.error ?? "Couldn't remove your photo.");
        return;
      }
      setAvatarUrl("");
      router.refresh();
    } catch {
      setAvatarError("Couldn't remove your photo.");
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red/40 bg-inset px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-lg border border-green/40 bg-inset px-3 py-2 text-sm text-green">
          Saved.
        </p>
      )}

      {/* photo */}
      <div>
        <span className="mb-2 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase">
          Photo
        </span>
        <div className="flex items-center gap-4">
          <Avatar src={avatarUrl.trim() || null} name={username} size={64} />
          <div className="min-w-0 flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPickFile}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={avatarBusy}
                onClick={() => fileRef.current?.click()}
              >
                {avatarBusy
                  ? "Working…"
                  : avatarUrl
                    ? "Change photo"
                    : "Upload photo"}
              </Button>
              {avatarUrl && !avatarBusy && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="text-xs text-secondary underline underline-offset-2 hover:text-red"
                >
                  Remove
                </button>
              )}
            </div>
            {avatarError ? (
              <p className="mt-1.5 text-xs text-red">{avatarError}</p>
            ) : (
              <p className="mt-1.5 text-xs text-secondary">
                PNG, JPEG, or WebP up to 4 MB. Cropped to a square.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* name */}
      <div>
        <label
          htmlFor="username"
          className="mb-2 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
        >
          Name
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          autoComplete="off"
          disabled={usernameLocked}
          className="h-11 w-full rounded-lg border border-line bg-inset px-3.5 text-sm placeholder:text-secondary focus:border-red focus:outline-none disabled:opacity-60"
        />
        <p className="mt-1.5 text-xs text-secondary">
          {usernameLocked
            ? `Locked until ${unlocksOn} — names change once every 30 days.`
            : "3–20 characters: letters, numbers, underscore. Changeable once every 30 days."}
        </p>
      </div>

      {/* commentator profile sections (FR-18.5) */}
      {isCommentator && (
        <>
          <div>
            <label
              htmlFor="about"
              className="mb-2 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
            >
              About
            </label>
            <textarea
              id="about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Who you are on the mic. Plain text, 280 characters."
              className="w-full rounded-lg border border-line bg-inset px-3.5 py-2.5 text-sm placeholder:text-secondary focus:border-red focus:outline-none"
            />
            <p className="mt-1 text-right font-mono text-[10px] text-secondary tabular-nums">
              {about.length}/280
            </p>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] font-bold tracking-wider text-secondary uppercase">
              Social links
            </p>
            <div className="space-y-2">
              {SOCIAL_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[13px] font-semibold">
                    {f.label}
                  </span>
                  <input
                    type="url"
                    inputMode="url"
                    value={socials[f.key]}
                    onChange={(e) =>
                      setSocials((s) => ({ ...s, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    aria-label={`${f.label} URL`}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-inset px-3 text-sm placeholder:text-secondary focus:border-red focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-secondary">
              Full https links only; shorteners are rejected. Leave a field
              blank to remove it.
            </p>
          </div>
        </>
      )}

      <Button type="submit" variant="red" disabled={busy} className="w-full sm:w-auto">
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
