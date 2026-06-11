"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FollowButton({
  commentatorId,
  initialFollowing,
}: {
  commentatorId: string;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    setFollowing(next); // optimistic
    setBusy(true);
    const res = await fetch("/api/follow", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentatorId }),
    });
    setBusy(false);
    if (!res.ok) {
      setFollowing(!next); // revert
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`h-11 rounded-lg px-5 text-sm font-semibold disabled:opacity-60 ${
        following
          ? "border border-line bg-surface hover:bg-raised"
          : "bg-red text-white"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
