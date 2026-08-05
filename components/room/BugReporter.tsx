"use client";

import { useState } from "react";

/**
 * In-room bug reporter (short-term testing tool). A small floating trigger opens
 * a compact form — a category + a description — and posts to /api/bugs with the
 * room, room state, path, and viewport auto-attached for triage. Open to guests
 * and signed-in users alike. Deliberately lightweight; retire after testing.
 */

const CATEGORIES = [
  "Audio / sync",
  "Chat",
  "Stats",
  "Layout / visual",
  "Something else",
];

function BugIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="7" width="12" height="13" rx="6" />
      <path d="M12 7v13" />
      <path d="M9 4l1.6 2.6M15 4l-1.6 2.6" />
      <path d="M3 10h3M18 10h3M3 15h3M18 15h3M4 20l3-2M20 20l-3-2" />
    </svg>
  );
}

export function BugReporter({
  roomId,
  roomState,
}: {
  roomId: string;
  roomState: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || description.trim().length < 3) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bugs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: description.trim(),
        category: category || undefined,
        roomId,
        roomState,
        path: window.location.pathname,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setSent(true);
      setDescription("");
      setCategory("");
    } else {
      const b = res ? await res.json().catch(() => ({})) : {};
      setError(b.error ?? "Couldn't submit. Try again.");
    }
  }

  function close() {
    setOpen(false);
    setSent(false);
    setError(null);
  }

  return (
    // sits ABOVE the chat composer + the mobile tab bar (founder 2026-08-05: at
    // bottom-24 it covered the message box and the send arrow). Includes the
    // safe-area inset so it tracks the tab bar on notched phones.
    <div className="fixed right-3 bottom-[calc(11rem+env(safe-area-inset-bottom))] z-50 lg:right-5 lg:bottom-24">
      {open ? (
        <div className="w-[min(92vw,340px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-raised">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-bold">
              <BugIcon /> Report a bug
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="rounded p-1 text-secondary transition-colors hover:text-primary"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          {sent ? (
            <div className="p-5 text-center">
              <p className="text-sm font-semibold">Thanks — logged it.</p>
              <p className="mt-1 text-xs text-secondary">
                We read every report during testing.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-raised"
                >
                  Report another
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg bg-red px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-2.5 p-4">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(category === c ? "" : c)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      category === c
                        ? "border-red bg-red/10 text-red"
                        : "border-line text-secondary hover:text-primary"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="What happened? What were you doing when it broke?"
                aria-label="Bug description"
                className="w-full resize-none rounded-lg border border-line bg-inset px-3 py-2 text-sm placeholder:text-secondary focus:border-red focus:outline-none"
              />
              {error && (
                <p role="alert" className="text-xs text-red">
                  {error}
                </p>
              )}
              <p className="text-[10px] leading-snug text-tertiary">
                Your page and device info is attached automatically to help us
                reproduce it.
              </p>
              <button
                type="submit"
                disabled={busy || description.trim().length < 3}
                className="h-10 w-full rounded-lg bg-red text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send report"}
              </button>
            </form>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3.5 py-2 text-xs font-semibold text-secondary shadow-raised backdrop-blur-sm transition-colors hover:text-primary"
        >
          <BugIcon /> Report a bug
        </button>
      )}
    </div>
  );
}
