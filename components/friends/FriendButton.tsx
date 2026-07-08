"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FriendState } from "@/lib/friends";

/**
 * Friend button (FR-23.5): Add friend / Requested / Friends / respond to an
 * incoming request, plus a Block action. All states optimistic; the server is
 * the source of truth on refresh. A blocked target shows only Unblock.
 */
export function FriendButton({
  targetUserId,
  initialState,
  initialBlocked,
}: {
  targetUserId: string;
  initialState: FriendState;
  initialBlocked: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<FriendState>(initialState);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: "POST" | "DELETE", body?: object) {
    setBusy(true);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setBusy(false);
    router.refresh();
    return res?.ok ?? false;
  }

  async function block() {
    if (!window.confirm("Block this user? You will no longer see each other.")) {
      return;
    }
    setBlocked(true);
    await call(`/api/blocks/${targetUserId}`, "POST");
  }
  async function unblock() {
    setBlocked(false);
    await call(`/api/blocks/${targetUserId}`, "DELETE");
  }

  if (blocked) {
    return (
      <button
        type="button"
        onClick={() => void unblock()}
        disabled={busy}
        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-raised disabled:opacity-60"
      >
        Unblock
      </button>
    );
  }

  async function add() {
    setState("requested");
    await call("/api/friends/request", "POST", { userId: targetUserId });
  }
  async function withdraw() {
    setState("none");
    await call(`/api/friends/${targetUserId}`, "DELETE");
  }
  async function respond(action: "accept" | "decline") {
    setState(action === "accept" ? "friends" : "none");
    await call("/api/friends/respond", "POST", { userId: targetUserId, action });
  }
  async function unfriend() {
    if (!window.confirm("Remove this friend?")) return;
    setState("none");
    await call(`/api/friends/${targetUserId}`, "DELETE");
  }

  return (
    <div className="flex items-center gap-2">
      {state === "none" && (
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy}
          className="rounded-lg bg-red px-4 py-2 text-sm font-bold text-white hover:bg-red-hover disabled:opacity-60"
        >
          Add friend
        </button>
      )}
      {state === "requested" && (
        <button
          type="button"
          onClick={() => void withdraw()}
          disabled={busy}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-secondary hover:bg-raised disabled:opacity-60"
        >
          Requested
        </button>
      )}
      {state === "incoming" && (
        <>
          <button
            type="button"
            onClick={() => void respond("accept")}
            disabled={busy}
            className="rounded-lg bg-red px-4 py-2 text-sm font-bold text-white hover:bg-red-hover disabled:opacity-60"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => void respond("decline")}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-secondary hover:bg-raised disabled:opacity-60"
          >
            Decline
          </button>
        </>
      )}
      {state === "friends" && (
        <button
          type="button"
          onClick={() => void unfriend()}
          disabled={busy}
          className="rounded-lg border border-green/40 bg-green/10 px-4 py-2 text-sm font-semibold text-green hover:bg-green/20 disabled:opacity-60"
        >
          Friends
        </button>
      )}
      <button
        type="button"
        onClick={() => void block()}
        disabled={busy}
        title="Block"
        aria-label="Block this user"
        className="rounded-lg border border-line px-2.5 py-2 text-sm text-secondary hover:border-red/50 hover:text-red disabled:opacity-60"
      >
        Block
      </button>
    </div>
  );
}
