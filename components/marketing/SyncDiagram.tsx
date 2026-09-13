/**
 * The signature "sync" visual (Programme reskin): a ruled ink box on paper -
 * "the sync, explained" as a printed stepper. A reference-clock row with
 * tabular figures, the [−0.5s][◎ SYNC NOW][+0.5s] control row, and an italic
 * confirmation that flips from "delay" to "locked · 0.0s ✓" (the fc-lockin /
 * fc-lockout hooks; the reduced-motion wildcard freezes it). No real data; it
 * demonstrates the mechanic, it doesn't report a live state.
 */
export function SyncDiagram() {
  return (
    <div className="border-2 border-primary bg-canvas">
      {/* box head */}
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-primary px-5 py-3 sm:px-6">
        <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-primary">
          THE SYNC, EXPLAINED
        </span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-tertiary">FIG. 1</span>
      </div>

      {/* reference clock row */}
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <span className="min-w-0">
          <span className="block font-mono text-[10px] tracking-[0.12em] text-tertiary">
            REFERENCE CLOCK
          </span>
          <span className="mt-1 block text-[13px] leading-snug text-secondary italic">
            tap Now the instant your own screen reaches it
          </span>
        </span>
        <span className="display shrink-0 text-[34px] tabular-nums">23:14</span>
      </div>

      {/* control row */}
      <div
        aria-hidden="true"
        className="flex items-stretch gap-2 border-b border-line px-5 py-4 sm:px-6"
      >
        <span className="flex flex-1 items-center justify-center border-2 border-primary py-[11px] font-mono text-[12px] font-semibold text-primary">
          −0.5s
        </span>
        <span className="flex flex-[1.6] items-center justify-center bg-red-fill py-[11px] font-mono text-[11px] font-bold tracking-[0.1em] text-on-red">
          ◎ SYNC NOW
        </span>
        <span className="flex flex-1 items-center justify-center border-2 border-primary py-[11px] font-mono text-[12px] font-semibold text-primary">
          +0.5s
        </span>
      </div>

      {/* confirmation readout: delay flips to locked */}
      <div className="relative h-[46px]">
        <span className="animate-fc-lockout absolute inset-x-5 top-1/2 -translate-y-1/2 text-center font-mono text-[13px] font-bold text-secondary italic sm:inset-x-6">
          delay −4.2s
        </span>
        <span className="animate-fc-lockin absolute inset-x-5 top-1/2 -translate-y-1/2 text-center font-mono text-[13px] font-bold text-green italic sm:inset-x-6">
          locked · 0.0s ✓
        </span>
      </div>
    </div>
  );
}
