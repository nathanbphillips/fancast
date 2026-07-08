/**
 * The signature "sync" visual (Matchday redesign): an illustrative match-timeline
 * where the fan-audio marker snaps from the live edge onto YOUR SCREEN and the
 * readout flips from "delay" to "locked". Pure CSS animation (fc-snap / fc-lockin
 * / fc-lockout / fc-ring), decorative only — the reduced-motion wildcard freezes
 * it. No real data; it demonstrates the mechanic, it doesn't report a live state.
 */
export function SyncDiagram() {
  return (
    <div
      className="rounded-[18px] border border-line p-[26px] shadow-raised"
      style={{
        background: "linear-gradient(180deg, var(--bg-raised), var(--bg-surface))",
      }}
    >
      <div className="mb-6 flex items-center justify-between">
        <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-tertiary">
          MATCH TIMELINE
        </span>
        <div className="relative h-5 min-w-[112px] text-right font-mono text-[15px] font-bold">
          <span className="animate-fc-lockout absolute top-0 right-0 text-secondary">
            delay −4.2s
          </span>
          <span className="animate-fc-lockin absolute top-0 right-0 text-green">
            locked 0.0s ✓
          </span>
        </div>
      </div>

      <div aria-hidden="true" className="relative h-[132px]">
        {/* baseline */}
        <div
          className="absolute top-16 right-0 left-0 h-[3px] rounded-full"
          style={{
            background:
              "linear-gradient(90deg, rgb(var(--hair) / 0.06), rgb(var(--hair) / 0.18))",
          }}
        />
        {/* ticks */}
        <div className="absolute top-[58px] right-0 left-0 flex justify-between">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="h-[15px] w-px"
              style={{ background: "rgb(var(--hair) / 0.12)" }}
            />
          ))}
        </div>
        {/* LIVE EDGE */}
        <div className="absolute top-6 left-[87%] -translate-x-1/2 text-center">
          <div className="mb-1.5 font-mono text-[9px] whitespace-nowrap text-tertiary">
            LIVE EDGE
          </div>
          <div className="mx-auto h-3 w-3 rounded-full border-2 border-tertiary bg-surface" />
        </div>
        {/* YOUR SCREEN */}
        <div className="absolute top-[78px] left-[33%] -translate-x-1/2 text-center">
          <div
            className="mx-auto mb-1.5 h-3 w-3 rounded-full border-2 bg-surface"
            style={{ borderColor: "var(--text-secondary)" }}
          />
          <div className="font-mono text-[9px] whitespace-nowrap text-secondary">
            YOUR SCREEN
          </div>
        </div>
        {/* FAN AUDIO — snaps from live edge onto your screen */}
        <div className="animate-fc-snap absolute top-[44px] left-[87%] -translate-x-1/2">
          <div className="relative flex flex-col items-center">
            <div className="mb-[5px] font-mono text-[9px] whitespace-nowrap text-red">
              FAN AUDIO
            </div>
            <div className="relative h-4 w-4">
              <span
                className="absolute inset-0 rounded-full bg-red"
                style={{ boxShadow: "0 0 12px rgba(239,1,7,.8)" }}
              />
              <span className="animate-fc-ring absolute inset-0 rounded-full border-2 border-red" />
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="mt-[18px] flex items-center gap-2">
        <span className="flex-1 rounded-[10px] border border-line bg-canvas py-[11px] text-center text-[12px] font-semibold text-secondary">
          −0.5s
        </span>
        <span className="btn-grad-red flex-[1.6] rounded-[10px] py-[11px] text-center font-mono text-[11px] font-extrabold text-white">
          ◎ SYNC NOW
        </span>
        <span className="flex-1 rounded-[10px] border border-line bg-canvas py-[11px] text-center text-[12px] font-semibold text-secondary">
          +0.5s
        </span>
      </div>
    </div>
  );
}
