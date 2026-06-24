"use client";

import { useRef, useState } from "react";
import type { SliderAggregate } from "@/lib/db/types";
import { useToast } from "@/components/Toast";

/**
 * Commentary<->Discussion slider (FR-10.2). Per-listener position posts on
 * release; the public aggregate meter renders for everyone and updates
 * via the control channel.
 */

export function AggregateMeter({ agg }: { agg: SliderAggregate }) {
  return (
    <div className="px-1">
      <div className="flex justify-between text-[11px] text-secondary">
        <span>Room mood</span>
        <span className="tabular-nums">
          {agg.count === 0
            ? "no votes yet"
            : `${agg.count} weighing in`}
        </span>
      </div>
      <div
        role="img"
        aria-label={`Room preference: ${agg.avg} of 100 toward discussion`}
        className="relative mt-1 h-1.5 rounded-full bg-raised"
      >
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas bg-gold transition-[left] duration-200"
          style={{ left: `${agg.count === 0 ? 50 : agg.avg}%` }}
        />
      </div>
    </div>
  );
}

export function PreferenceSlider({
  roomId,
  myValue,
  agg,
  enabled,
}: {
  roomId: string;
  myValue: number | null;
  agg: SliderAggregate;
  enabled: boolean;
}) {
  const [value, setValue] = useState(myValue ?? 50);
  const lastSent = useRef<number | null>(myValue);
  const toast = useToast();

  async function commit() {
    if (!enabled || lastSent.current === value) return;
    const sent = value;
    lastSent.current = sent;
    try {
      const res = await fetch("/api/slider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, value: sent }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // clear the de-dupe latch so the next release re-sends this position
      if (lastSent.current === sent) lastSent.current = null;
      toast("Couldn't save your slider position.");
    }
  }

  return (
    <div className="mt-3 space-y-2 px-1">
      <div>
        <label
          htmlFor="pref-slider"
          className="flex justify-between text-xs text-secondary"
        >
          <span>More commentary</span>
          <span>More discussion</span>
        </label>
        <input
          id="pref-slider"
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={!enabled}
          onChange={(e) => setValue(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="mt-1 h-2 w-full accent-(--gold) disabled:opacity-60"
        />
      </div>
      <AggregateMeter agg={agg} />
    </div>
  );
}
