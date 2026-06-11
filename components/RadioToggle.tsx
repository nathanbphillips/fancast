"use client";

import { useState } from "react";

/** Radio-Only toggle shell (FR-5.4): UI state only until the HLS path
 *  lands in Phase 5. */
export function RadioToggle() {
  const [on, setOn] = useState(false);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      title="Radio-only audio arrives in Phase 5"
      className={`flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${
        on
          ? "border-gold text-gold"
          : "border-line bg-surface text-secondary hover:bg-raised"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${on ? "bg-gold" : "bg-line"}`}
      />
      Radio
    </button>
  );
}
