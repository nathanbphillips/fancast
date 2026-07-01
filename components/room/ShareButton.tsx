"use client";

import { useState } from "react";

/**
 * Room "Share" control (Cloud Design match bar). Uses the native share sheet
 * where available (mobile), otherwise copies the room URL to the clipboard and
 * flashes "Copied". Presentational-only; never touches the audio/realtime engine.
 */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        /* user dismissed the share sheet — nothing to do */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-secondary transition-colors hover:border-gold hover:text-primary"
    >
      {copied ? "Copied" : "Share"}
    </button>
  );
}
