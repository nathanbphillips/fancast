import type { ReactNode } from "react";

/** Small mono pill/badge — LIVE/ON AIR (red), outline, or gold. `live` adds a
 *  pulsing dot (white on red, red on outline). */
export function Pill({
  children,
  variant = "red",
  live = false,
  className = "",
}: {
  children: ReactNode;
  variant?: "red" | "outline" | "gold";
  live?: boolean;
  className?: string;
}) {
  const styles =
    variant === "red"
      ? "bg-red text-white"
      : variant === "gold"
        ? "border border-gold text-gold"
        : "border border-line text-secondary";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider uppercase ${styles} ${className}`}
    >
      {live && (
        <span
          aria-hidden="true"
          className={`inline-block h-1.5 w-1.5 animate-fcpulse rounded-full ${variant === "red" ? "bg-white" : "bg-red"}`}
        />
      )}
      {children}
    </span>
  );
}
