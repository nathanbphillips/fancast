"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

/**
 * Completes a deferred RSVP after sign-in. "RSVP for notifications" on a
 * scheduled room sends logged-out users through sign-in with `?rsvp=1` on the
 * room URL (surviving onboarding). On arrival — now signed in, with a profile —
 * this fires the RSVP once, strips the param so a refresh/back won't re-fire it,
 * and confirms. Idempotent server-side (upsert); a harmless no-op if the room
 * has since opened (409) or the visitor is still a guest (401).
 */
export function RsvpIntent({
  roomId,
  signedIn,
}: {
  roomId: string;
  signedIn: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !signedIn) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("rsvp") !== "1") return;
    done.current = true;

    params.delete("rsvp");
    const q = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (q ? `?${q}` : "") + window.location.hash,
    );

    void (async () => {
      const res = await fetch(`/api/rooms/${roomId}/rsvp`, {
        method: "POST",
      }).catch(() => null);
      if (res?.ok) {
        toast("You're in — we'll notify you when the room opens.");
        router.refresh(); // reflect the RSVP in the on-screen button/count
      }
    })();
  }, [roomId, signedIn, toast, router]);

  return null;
}
