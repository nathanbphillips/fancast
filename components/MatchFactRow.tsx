"use client";

import { useState } from "react";

/**
 * One match fact with a copy button on the right.
 *
 * Shared by the in-room host tab and /admin/match-facts so the two cannot drift.
 * The text is plain selectable prose rather than a giant button: a host reading
 * on air wants to grab a phrase as often as the whole line, and an accidental
 * tap on a full-width button copies something they did not mean to.
 */
export function MatchFactRow({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // silently doing nothing leaves the host believing they copied it
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <li className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2">
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-primary">{text}</p>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={state === "failed" ? "Copy failed, select the text instead" : "Copy this fact"}
        title={state === "failed" ? "Couldn't copy: select the text instead" : "Copy"}
        className={`-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
          state === "copied"
            ? "border-green/50 text-green"
            : state === "failed"
              ? "border-red/50 text-red"
              : "border-line text-secondary hover:bg-raised hover:text-primary"
        }`}
      >
        {state === "copied" ? (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        ) : state === "failed" ? (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 012-2h10" />
          </svg>
        )}
      </button>
      {/* announced, because the icon swap alone tells a screen reader nothing */}
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : ""}
      </span>
    </li>
  );
}
