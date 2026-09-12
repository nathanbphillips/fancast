/** Pulsing deep-red "lamp" dot (Programme). Flat fill, no glow. Decorative. */
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
      className={`inline-block shrink-0 animate-fcpulse rounded-full bg-red-fill ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
