"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";

/**
 * Bare-bones profile editor (Cloud Design): the name + photo a room sees.
 * Photo is a free-text https image URL for the MVP (no upload bucket yet, so
 * this needs no migration); PATCH /api/profile persists it alongside the
 * username. Username keeps its 30-day change lock (enforced server-side).
 */
export function ProfileSettingsForm({
  initialUsername,
  initialAvatarUrl,
  usernameLocked,
  unlocksOn,
}: {
  initialUsername: string;
  initialAvatarUrl: string | null;
  usernameLocked: boolean;
  unlocksOn: string | null;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    const body: Record<string, string> = { avatar_url: avatarUrl.trim() };
    if (username.trim().toLowerCase() !== initialUsername.toLowerCase()) {
      body.username = username.trim();
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
        <label
          htmlFor="avatar"
          className="mb-2 block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
        >
          Photo
        </label>
        <div className="flex items-center gap-4">
          <Avatar src={avatarUrl.trim() || null} name={username} size={64} />
          <div className="min-w-0 flex-1">
            <input
              id="avatar"
              type="url"
              inputMode="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…/your-photo.jpg"
              className="h-11 w-full rounded-lg border border-line bg-inset px-3.5 text-sm placeholder:text-secondary focus:border-red focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-secondary">
              Paste an https image link. Leave blank to use your initial.
            </p>
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

      <Button type="submit" variant="red" disabled={busy} className="w-full sm:w-auto">
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
