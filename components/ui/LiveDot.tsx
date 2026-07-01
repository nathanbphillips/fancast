/** Pulsing brand-red "live" dot with a soft glow (Cloud Design). Decorative. */
export function LiveDot({
  size = 6,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-fcpulse rounded-full bg-red ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: "0 0 8px rgba(241, 35, 43, 0.85)",
      }}
    />
  );
}
