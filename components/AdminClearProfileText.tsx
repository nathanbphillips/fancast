"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin moderation (FR-18.6): clear a profile's about text or social links,
 *  the same pattern as the avatar clear. */
export function AdminClearProfileText({
  userId,
  section,
}: {
  userId: string;
  section: "about" | "social_links";
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function clear() {
    setBusy(true);
    const res = await fetch("/api/admin/clear-profile-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, section }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
  }

  const label = section === "about" ? "Clear about (admin)" : "Clear socials (admin)";
  return (
    <button
      type="button"
      onClick={() => void clear()}
      disabled={busy}
      className="rounded-md border border-red/40 px-2.5 py-1 text-xs font-semibold text-red transition-colors hover:bg-red/10 disabled:opacity-60"
    >
      {busy ? "Clearing…" : label}
    </button>
  );
}
