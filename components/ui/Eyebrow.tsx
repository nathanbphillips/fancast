import type { ReactNode } from "react";
import { LiveDot } from "./LiveDot";

/** Space-Mono uppercase eyebrow label with a leading dot (gold or live-red). */
export function Eyebrow({
  children,
  dot = "gold",
  className = "",
}: {
  children: ReactNode;
  dot?: "gold" | "live" | "none";
  className?: string;
}) {
  return (
    <p
      className={`flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em] text-red uppercase ${className}`}
    >
      {dot === "live" ? (
        <LiveDot />
      ) : dot === "gold" ? (
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full bg-red"
        />
      ) : null}
      {children}
    </p>
  );
}
