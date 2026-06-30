"use client";

import { useState } from "react";

/**
 * Avatar (redesign 2026-06-29): a user's profile image, or a deterministic
 * coloured initial-circle when there's none (or it fails to load). Uses a plain
 * <img> — no next/image, since no `images.remotePatterns` is configured and the
 * CSP already allows https/data images — mirroring LinkThumb in RealtimeRoom.
 * The fallback hue is hashed from the name so a user's circle colour is stable,
 * with white text at a fixed lightness that reads on both light and dark canvas.
 */
export function Avatar({
  src,
  name,
  size = 24,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const label = (name ?? "").trim();
  const initial = label ? label[0]!.toUpperCase() : "?";

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full border border-line object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase leading-none text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.44),
        backgroundColor: `hsl(${hueFromName(label || "?")} 52% 42%)`,
      }}
    >
      {initial}
    </span>
  );
}

function hueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return h;
}
