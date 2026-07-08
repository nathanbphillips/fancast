"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Invite a co-host to a room by username (FR-25.1), plus a chip list of the
 * room's other accepted hosts. Shown per scheduled/waiting room the caller
 * hosts, only while there's room for a second host.
 */
export function InviteCohost({
  roomId,
  coHosts,
  canInvite,
}: {
  roomId: string;
  coHosts: string[];
  canInvite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/rooms/${roomId}/cohost-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setMsg(body?.error ?? "Couldn't send the invite.");
      return;
    }
    setMsg(`Invite sent to ${username.trim()}.`);
    setUsername("");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase">
      {coHosts.map((h) => (
        <span key={h} className="rounded-sm bg-red/10 px-1 text-red normal-case">
          with @{h}
        </span>
      ))}
      {canInvite &&
        (open ? (
          <form onSubmit={invite} className="flex items-center gap-1">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              aria-label="Co-host username"
              className="h-6 w-24 rounded border border-line bg-inset px-1.5 text-[11px] normal-case"
            />
            <button
              type="submit"
              disabled={busy || !username.trim()}
              className="rounded bg-red px-1.5 py-0.5 text-[10px] font-bold text-white disabled:opacity-60"
            >
              Invite
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-secondary"
            >
              cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-secondary underline-offset-2 hover:text-primary hover:underline normal-case"
          >
            + co-host
          </button>
        ))}
      {msg && <span className="text-secondary normal-case">{msg}</span>}
    </div>
  );
}
