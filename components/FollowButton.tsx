"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

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
  const toast = useToast();

  async function toggle() {
    const next = !following;
    setFollowing(next); // optimistic
    setBusy(true);
    const res = await fetch("/api/follow", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentatorId }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setFollowing(!next); // revert
      toast(next ? "Couldn't follow - try again." : "Couldn't unfollow - try again.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`h-11 px-5 text-sm font-semibold disabled:opacity-60 ${
        following
          ? "border-2 border-primary font-mono tracking-[0.08em] text-primary hover:text-red"
          : "btn-grad-red"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
