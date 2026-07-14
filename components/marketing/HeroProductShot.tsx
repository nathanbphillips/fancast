/**
 * Hero product shot (Matchday redesign): a tilted, illustrative preview of the
 * room UI — player + chat + stats. Decorative (aria-hidden); the hero copy
 * carries the meaning for assistive tech. HONESTY: this is a labelled Preview
 * with SAMPLE in-UI values (score, stats, poll) and an ARCHETYPE host ("Your
 * host", never a named person). It deliberately shows NO fabricated engagement
 * counts (no "listening"/"talking"/"messages" numbers) — those would read as
 * invented momentum, which we don't show pre-launch.
 */
export function HeroProductShot() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto mt-14 max-w-[1010px]"
      style={{ perspective: "2200px" }}
    >
      {/* floor glow */}
      <div
        className="pointer-events-none absolute -bottom-10 left-1/2 h-[120px] w-[78%] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse, rgba(239,1,7,.32), transparent 70%)",
          filter: "blur(30px)",
        }}
      />

      {/* floating chips */}
      <div className="animate-fcbob absolute top-6 -left-3 z-10 hidden items-center gap-2.5 rounded-[13px] border border-line bg-raised/90 px-[15px] py-3 shadow-raised backdrop-blur-sm sm:flex">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[11px] font-bold text-white" style={{ background: "linear-gradient(135deg,#ef0107,#7a0a12)" }}>
          ●
        </span>
        <span className="text-left">
          <span className="block text-[12px] font-bold text-primary">A host is live</span>
          <span className="block font-mono text-[10px] text-secondary">tap in to the room</span>
        </span>
        <span className="h-2.5 w-2.5 animate-fc-blink rounded-full bg-red" />
      </div>
      <div className="animate-fcbob absolute top-40 -right-4 z-10 hidden items-center gap-2.5 rounded-[13px] border border-line bg-raised/90 px-[15px] py-3 shadow-raised backdrop-blur-sm md:flex" style={{ animationDelay: "-2.4s" }}>
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[15px] font-extrabold text-green" style={{ background: "rgba(52,209,122,.16)" }}>
          ✓
        </span>
        <span className="text-left">
          <span className="block text-[12px] font-bold text-primary">Synced to your screen</span>
          <span className="block font-mono text-[10px] text-secondary">delay locked · 0.0s</span>
        </span>
      </div>

      {/* window */}
      <div
        className="rounded-[18px]"
        style={{ transform: "rotateX(4deg) rotateY(-9deg)", transformStyle: "preserve-3d" }}
      >
        <div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-raised">
          {/* chrome */}
          <div className="flex items-center gap-2 border-b border-line bg-canvas px-[18px] py-3">
            <span className="h-[11px] w-[11px] rounded-full" style={{ background: "#3a3a42" }} />
            <span className="h-[11px] w-[11px] rounded-full" style={{ background: "#3a3a42" }} />
            <span className="h-[11px] w-[11px] rounded-full" style={{ background: "#3a3a42" }} />
            <span className="ml-3 rounded-[7px] bg-inset px-3.5 py-[5px] font-mono text-[11px] text-tertiary">
              arseradio.com/room/arsenal-v-coventry
            </span>
            <span className="ml-auto rounded-[6px] border border-line px-2 py-1 font-mono text-[10px] font-bold tracking-[0.08em] text-tertiary">
              PREVIEW
            </span>
          </div>

          {/* 3-column room */}
          <div className="grid gap-3 p-4 text-left md:grid-cols-[1.05fr_1.3fr_1fr]">
            {/* player */}
            <div className="flex flex-col gap-3 rounded-[13px] border border-line bg-canvas p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-red px-2 py-1 font-mono text-[10px] font-bold text-white">
                  <span className="h-[5px] w-[5px] animate-fc-blink rounded-full bg-white" />
                  ON AIR
                </span>
                <span className="font-mono text-[11px] text-tertiary tabular-nums">1H 23:14</span>
              </div>
              <div className="flex items-center justify-between rounded-[11px] bg-surface px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-red font-mono text-[9px] font-bold text-white">ARS</span>
                  <span className="display text-[26px] tabular-nums">2</span>
                </span>
                <span className="font-mono text-[10px] text-tertiary">1H</span>
                <span className="flex items-center gap-2">
                  <span className="display text-[26px] tabular-nums">0</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-[7px] font-mono text-[9px] font-bold text-white" style={{ background: "#6a1a2c" }}>BUR</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-full" style={{ background: "linear-gradient(135deg,#ef0107,#7a0a12)" }} />
                <span className="flex-1">
                  <span className="block text-[12px] font-bold text-primary">Your host</span>
                  <span className="block font-mono text-[10px] text-secondary">a real Arsenal supporter · speaking</span>
                </span>
                <span className="flex h-[18px] items-end gap-[2px]">
                  {[0.6, 1, 0.5, 0.8].map((d, i) => (
                    <span key={i} className="animate-fceq w-[3px] rounded-[2px] bg-red" style={{ height: "18px", animationDelay: `-${d}s` }} />
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-[9px] border border-line bg-surface py-[9px] text-center font-mono text-[11px] font-semibold text-secondary">−0.5s</span>
                <span className="btn-grad-red flex-[1.4] rounded-[9px] py-[9px] text-center font-mono text-[10px] font-extrabold text-white">◎ SYNC NOW</span>
                <span className="flex-1 rounded-[9px] border border-line bg-surface py-[9px] text-center font-mono text-[11px] font-semibold text-secondary">+0.5s</span>
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-tertiary">
                <span className="h-1.5 w-1.5 rounded-full bg-green" />
                Locked · 0.0s
              </span>
            </div>

            {/* chat */}
            <div className="flex flex-col gap-2.5 rounded-[13px] border border-line bg-canvas p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.06em] text-tertiary">THE ROOM</span>
                <span className="flex gap-1">
                  <span className="rounded-[11px] bg-red px-2 py-1 text-[9px] font-bold text-white">Top</span>
                  <span className="rounded-[11px] bg-surface px-2 py-1 text-[9px] font-semibold text-secondary">New</span>
                </span>
              </div>
              <div className="flex gap-2">
                <span className="h-[26px] w-[26px] shrink-0 rounded-full" style={{ background: "#2a4a8a" }} />
                <span>
                  <span className="block text-[12px] font-bold text-primary">Mikel_92 <span className="font-normal text-tertiary">· 23&apos;</span></span>
                  <span className="block text-[12px] leading-snug text-secondary">Ødegaard running this half on his own. Take a bow.</span>
                </span>
              </div>
              <div className="rounded-[11px] border border-line bg-surface p-3">
                <div className="mb-2 text-[11px] font-bold text-primary">Half-time poll · MOTM?</div>
                {[["Ødegaard", 64], ["Saka", 24]].map(([name, pct]) => (
                  <div key={name as string} className="relative mb-1 h-[22px] overflow-hidden rounded-[6px] bg-canvas last:mb-0">
                    <div className="absolute inset-0" style={{ width: `${pct}%`, background: "rgba(239,1,7,.28)" }} />
                    <div className="relative flex justify-between px-2 text-[10px] font-bold leading-[22px] text-primary">
                      <span>{name}</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <span className="mt-auto flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 font-mono text-[11px] text-tertiary">
                Sign in to join the room…
              </span>
            </div>

            {/* stats */}
            <div className="flex flex-col gap-3 rounded-[13px] border border-line bg-canvas p-4">
              <span className="font-mono text-[10px] tracking-[0.06em] text-tertiary">STATS · LIVE</span>
              <div>
                <div className="mb-1.5 flex justify-between text-[11px] font-bold text-primary">
                  <span>Possession</span>
                  <span className="text-secondary tabular-nums">58 · 42</span>
                </div>
                <div className="flex h-[7px] overflow-hidden rounded-[4px]" style={{ background: "#2a2a31" }}>
                  <span className="animate-fc-grow origin-left" style={{ width: "58%", background: "linear-gradient(90deg,#ef0107,#ff3b38)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[9px] bg-surface p-2.5">
                  <div className="display text-[20px] text-red tabular-nums">1.94</div>
                  <div className="font-mono text-[10px] text-secondary">xG</div>
                </div>
                <div className="rounded-[9px] bg-surface p-2.5">
                  <div className="display text-[20px] tabular-nums">14</div>
                  <div className="font-mono text-[10px] text-secondary">Shots</div>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-bold text-primary">Momentum</div>
                <div className="flex h-[30px] items-end gap-[2px]">
                  {[40, 62, 88, 96, 54, 34, 70, 82, 48].map((h, i) => (
                    <span key={i} className="flex-1 rounded-[1px]" style={{ height: `${h}%`, background: h > 50 ? "#ef0107" : "#2a2a31" }} />
                  ))}
                </div>
              </div>
              <div className="font-mono text-[10px] text-tertiary">
                Lineups &amp; team news pushed by your host
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
