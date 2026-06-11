"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * First-login username pick (POST) and later renames (PATCH, 30-day lock —
 * enforced server-side in /api/profile).
 */
export function UsernameForm({
  mode,
  currentUsername,
}: {
  mode: "create" | "change";
  currentUsername?: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(currentUsername ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/profile", {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong. Try again.");
      return;
    }
    if (mode === "create") {
      router.push("/");
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red/40 bg-surface px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}
      <label htmlFor="username" className="block text-sm font-semibold">
        Username
      </label>
      <input
        id="username"
        type="text"
        required
        minLength={3}
        maxLength={20}
        pattern="[A-Za-z0-9_]{3,20}"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="gunner_steve"
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
      />
      <p className="text-xs text-secondary">
        3-20 characters: letters, numbers, underscore. Changeable once every
        30 days.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-lg bg-red text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy
          ? "Saving…"
          : mode === "create"
            ? "Claim username"
            : "Change username"}
      </button>
    </form>
  );
}
