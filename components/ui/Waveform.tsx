/**
 * Decorative audio waveform with a sweeping playhead (Cloud Design). NOT wired
 * to real amplitude — a visual, matching the prototype. Bar heights are
 * deterministic (SSR-stable, no Math.random).
 */
export function Waveform({
  bars = 40,
  height = 40,
  className = "",
}: {
  bars?: number;
  height?: number;
  className?: string;
}) {
  const heights = Array.from({ length: bars }, (_, i) =>
    Math.round(28 + 60 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.29))),
  );
  return (
    <div
      aria-hidden="true"
      className={`relative flex items-center overflow-hidden ${className}`}
      style={{ height }}
    >
      <div className="flex flex-1 items-center gap-[3px]">
        {heights.map((h, i) => (
          <span
            key={i}
            className="min-w-[2px] flex-1 rounded-full"
            style={{
              height: `${Math.max(12, Math.min(100, h))}%`,
              background:
                "linear-gradient(to top, rgba(241,35,43,0.95), rgba(241,35,43,0.18))",
            }}
          />
        ))}
      </div>
      <span
        className="animate-fcsweep pointer-events-none absolute top-0 h-full w-0.5"
        style={{
          background:
            "linear-gradient(to bottom, transparent, #f1232b, transparent)",
        }}
      />
    </div>
  );
}
