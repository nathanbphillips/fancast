"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Avatar (redesign 2026-06-29): a user's profile image, or a deterministic
 * coloured initial-circle when there's none (or it fails to load). Rendered
 * through next/image (audit 2026-07-02): the browser only requests
 * /_next/image on OUR origin and the optimizer fetches the upstream image
 * server-side, so a hostile avatar host can't harvest room participants' IPs
 * (tracking pixel). The fallback hue is hashed from the name so a user's
 * circle colour is stable, with white text that reads on both themes.
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
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
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
