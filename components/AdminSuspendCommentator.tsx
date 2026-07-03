"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin-only: revert a commentator to listener (FR-18.2). Their scheduled
 * rooms are canceled server-side; the suspension is never announced. Confirm
 * step because this is destructive to their schedule.
 */
export function AdminSuspendCommentator({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function suspend() {
    if (
      !window.confirm(
        `Suspend ${username}'s commentator account? Their scheduled rooms are canceled. This is not announced to anyone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/suspend-commentator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error ?? "Couldn't suspend.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void suspend()}
        disabled={busy}
        className="rounded-md border border-red/40 px-2.5 py-1 text-xs font-semibold text-red transition-colors hover:bg-red/10 disabled:opacity-60"
      >
        {busy ? "Suspending…" : "Suspend commentator (admin)"}
      </button>
      {error && <span className="text-xs text-red">{error}</span>}
    </span>
  );
}
