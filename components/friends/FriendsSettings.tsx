"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";

/**
 * Settings: Friends (FR-23.5). Incoming requests (accept/decline), the friend
 * list (unfriend), and the blocked list (unblock). All visible only to the
 * owner.
 */
export type PersonRow = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

export function FriendsSettings({
  incoming,
  friends,
  blocked,
}: {
  incoming: PersonRow[];
  friends: PersonRow[];
  blocked: PersonRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(
    key: string,
    url: string,
    method: "POST" | "DELETE",
    body?: object,
  ) {
    setBusy(key);
    await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setBusy(null);
    router.refresh();
  }

  const row = (p: PersonRow, actions: React.ReactNode) => (
    <div
      key={p.userId}
      className="flex items-center gap-3 border-t border-line/60 px-3 py-2.5 first:border-t-0"
    >
      <Avatar src={p.avatarUrl} name={p.username} size={30} />
      <Link
        href={`/${p.username}`}
        className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
      >
        {p.username}
      </Link>
      {actions}
    </div>
  );

  return (
    <div className="space-y-6">
      {incoming.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] font-bold tracking-wider text-secondary uppercase">
            Friend requests
          </p>
          <div className="overflow-hidden rounded-xl border-[0.75px] border-line">
            {incoming.map((p) =>
              row(
                p,
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy === p.userId}
                    onClick={() =>
                      void act(p.userId, "/api/friends/respond", "POST", {
                        userId: p.userId,
                        action: "accept",
                      })
                    }
                    className="rounded-md bg-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy === p.userId}
                    onClick={() =>
                      void act(p.userId, "/api/friends/respond", "POST", {
                        userId: p.userId,
                        action: "decline",
                      })
                    }
                    className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-secondary disabled:opacity-60"
                  >
                    Decline
                  </button>
                </span>,
              ),
            )}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 font-mono text-[11px] font-bold tracking-wider text-secondary uppercase">
          Friends
        </p>
        {friends.length === 0 ? (
          <p className="text-[13px] text-secondary">No friends yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border-[0.75px] border-line">
            {friends.map((p) =>
              row(
                p,
                <button
                  type="button"
                  disabled={busy === p.userId}
                  onClick={() =>
                    void act(p.userId, `/api/friends/${p.userId}`, "DELETE")
                  }
                  className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-secondary hover:border-red/50 hover:text-red disabled:opacity-60"
                >
                  Unfriend
                </button>,
              ),
            )}
          </div>
        )}
      </div>

      {blocked.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] font-bold tracking-wider text-secondary uppercase">
            Blocked
          </p>
          <div className="overflow-hidden rounded-xl border-[0.75px] border-line">
            {blocked.map((p) =>
              row(
                p,
                <button
                  type="button"
                  disabled={busy === p.userId}
                  onClick={() =>
                    void act(p.userId, `/api/blocks/${p.userId}`, "DELETE")
                  }
                  className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-secondary hover:bg-raised disabled:opacity-60"
                >
                  Unblock
                </button>,
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
