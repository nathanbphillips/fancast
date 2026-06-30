/**
 * Hero illustration (redesign): a stylised "matchday companion" vignette — your
 * own screen with the FanCast room riding alongside it. All vector + theme
 * tokens, decorative only. Deliberately abstract: NO club crests, kits, player
 * figures, or broadcast/scoreboard chrome (golden rule + affiliation safety).
 */
export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 400"
      className={`h-auto w-full ${className}`}
      role="img"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="heroGlow" cx="55%" cy="42%" r="60%">
          <stop offset="0%" style={{ stopColor: "var(--gold)", stopOpacity: 0.22 }} />
          <stop offset="100%" style={{ stopColor: "var(--gold)", stopOpacity: 0 }} />
        </radialGradient>
        <filter id="heroShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#000" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* warm glow */}
      <rect x="0" y="0" width="480" height="400" fill="url(#heroGlow)" />

      {/* "your screen" — abstract pitch, never a real broadcast */}
      <g>
        <rect x="36" y="66" width="300" height="210" rx="20" className="fill-surface stroke-line" strokeWidth="2" />
        <rect x="54" y="84" width="264" height="174" rx="10" className="fill-green" opacity="0.12" />
        <line x1="186" y1="84" x2="186" y2="258" className="stroke-line" strokeWidth="2" />
        <circle cx="186" cy="171" r="28" className="stroke-line" strokeWidth="2" fill="none" />
        <circle cx="186" cy="171" r="3" className="fill-line" />
        <rect x="54" y="140" width="26" height="62" rx="2" className="stroke-line" strokeWidth="2" fill="none" />
        <rect x="292" y="140" width="26" height="62" rx="2" className="stroke-line" strokeWidth="2" fill="none" />
      </g>

      {/* sync-clock chip */}
      <g filter="url(#heroShadow)">
        <rect x="28" y="40" width="128" height="44" rx="14" className="fill-surface stroke-line" strokeWidth="1.5" />
        <circle cx="50" cy="62" r="4" className="fill-green" />
        <text x="64" y="68" className="fill-primary font-display" fontSize="20" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>
          1H 23:14
        </text>
      </g>

      {/* FanCast companion card, riding alongside */}
      <g filter="url(#heroShadow)">
        <rect x="232" y="150" width="216" height="208" rx="20" className="fill-surface stroke-line" strokeWidth="2" />

        {/* LIVE pill */}
        <rect x="252" y="170" width="62" height="24" rx="12" className="fill-red" />
        <circle cx="265" cy="182" r="4" className="animate-live-pulse fill-white" />
        <text x="276" y="186" className="fill-white" fontSize="12" fontWeight="700">LIVE</text>

        {/* chat rows with up-votes */}
        {[212, 242, 272].map((y, i) => (
          <g key={y}>
            <path d={`M256 ${y + 13} l5 -8 5 8 z`} className="fill-gold" />
            <rect x="272" y={y} width={[150, 120, 138][i]} height="20" rx="7" className="fill-raised" />
          </g>
        ))}

        {/* audio waveform */}
        <g>
          {Array.from({ length: 18 }).map((_, i) => {
            const heights = [10, 18, 26, 16, 30, 22, 12, 24, 34, 20, 14, 28, 18, 32, 22, 12, 24, 16];
            const h = heights[i];
            return (
              <rect
                key={i}
                x={252 + i * 10}
                y={332 - h / 2}
                width="4"
                height={h}
                rx="2"
                className={i % 3 === 0 ? "fill-red" : "fill-gold"}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}
