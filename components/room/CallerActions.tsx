"use client";

import { useState } from "react";

/**
 * Commentator's caller-management popover (founder decision 2026-06-11):
 * flag (informational note shared between commentators) or block
 * (explicit, reversible bar on call-ins). Distinct from ending a call,
 * which is always neutral.
 */
export function CallerActions({
  userId,
  username,
  roomId,
}: {
  userId: string;
  username: string;
  roomId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function act(action: "flag" | "block") {
    setBusy(true);
    const res = await fetch("/api/callers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "flag"
          ? { action, userId, roomId, note: note.trim() || undefined }
          : { action, userId, reason: note.trim() || undefined },
      ),
    });
    setBusy(false);
    setConfirmBlock(false);
    if (res.ok) {
      setDone(action === "flag" ? "Flagged" : "Blocked from call-ins");
      setNote("");
      setTimeout(() => {
        setDone(null);
        setOpen(false);
      }, 1500);
    }
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={`Caller actions for ${username}`}
        aria-expanded={open}
        title="Flag or block this caller"
        onClick={() => {
          setOpen(!open);
          setConfirmBlock(false);
          setDone(null);
        }}
        className="px-1.5 text-xs text-secondary hover:text-red"
      >
        ⚑
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-1 w-64 rounded-xl border-[0.75px] border-line bg-surface p-3 shadow-lg">
          {done ? (
            <p className="text-sm font-semibold text-green">✓ {done}</p>
          ) : (
            <>
              <p className="text-xs font-bold">{username}</p>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="Note (optional) — other commentators see it"
                aria-label="Flag note"
                className="mt-2 h-9 w-full rounded-md border border-line bg-raised px-2 text-xs placeholder:text-secondary"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act("flag")}
                  className="h-9 flex-1 rounded-md bg-red text-xs font-bold text-white disabled:opacity-60"
                >
                  Flag caller
                </button>
                {confirmBlock ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act("block")}
                    className="h-9 flex-1 rounded-md bg-red text-xs font-bold text-white disabled:opacity-60"
                  >
                    Confirm block
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmBlock(true)}
                    className="h-9 flex-1 rounded-md border border-red text-xs font-semibold text-red"
                  >
                    Block call-ins
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-secondary">
                Flags are private to commentators. Blocking only stops future
                call-ins and is reversible.
              </p>
            </>
          )}
        </div>
      )}
    </span>
  );
}
