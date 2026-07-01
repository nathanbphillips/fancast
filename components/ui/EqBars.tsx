/** 3 staggered equalizer bars (host "speaking" indicator). Decorative. */
export function EqBars({
  className = "",
  color = "bg-red",
  height = 12,
}: {
  className?: string;
  color?: string;
  height?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-end gap-[2px] ${className}`}
      style={{ height }}
    >
      {[0, 0.18, 0.36].map((delay, i) => (
        <span
          key={i}
          className={`w-[3px] origin-bottom animate-fceq rounded-full ${color}`}
          style={{ height: "100%", animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}
