"use client";

import { useState } from "react";

/**
 * Share control. Uses the native share sheet where available (mobile), otherwise
 * copies the link to the clipboard and flashes "Copied". With no props it shares
 * the current page (the in-room match bar); pass `url`/`text` to share a specific
 * room from a list (e.g. the /matches rows). `compact` renders an icon-only
 * button. Presentational-only; never touches the audio/realtime engine.
 */
export function ShareButton({
  url,
  text,
  compact = false,
  className = "",
}: {
  /** relative or absolute; relative is resolved against the current origin */
  url?: string;
  text?: string;
  compact?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof window === "undefined") return;
    const shareUrl = url
      ? new URL(url, window.location.origin).href
      : window.location.href;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(text ? { url: shareUrl, text } : { url: shareUrl });
      } catch {
        /* user dismissed the share sheet — nothing to do */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={share}
        aria-label="Share this room"
        title={copied ? "Copied" : "Share"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-secondary transition-colors hover:border-line hover:text-primary ${className}`}
      >
        {copied ? (
          <span className="font-mono text-[9px] tracking-tight uppercase">
            Copied
          </span>
        ) : (
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
            <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-secondary transition-colors hover:border-line hover:text-primary ${className}`}
    >
      {copied ? "Copied" : "Share"}
    </button>
  );
}
