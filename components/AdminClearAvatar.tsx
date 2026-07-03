"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin-only moderation control on public profiles: reset a user's avatar to
 *  the initial-circle fallback (audit 2026-07-02). */
export function AdminClearAvatar({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function clear() {
    setBusy(true);
    const res = await fetch("/api/admin/clear-avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void clear()}
      disabled={busy}
      className="rounded-md border border-red/40 px-2.5 py-1 text-xs font-semibold text-red transition-colors hover:bg-red/10 disabled:opacity-60"
    >
      {busy ? "Clearing…" : "Clear avatar (admin)"}
    </button>
  );
}
