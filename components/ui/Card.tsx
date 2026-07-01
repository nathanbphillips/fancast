import type { ReactNode } from "react";

/** Panel surface + border + elevation. `glow` uses the raised/brand-glow shadow. */
export function Card({
  children,
  glow = false,
  className = "",
}: {
  children: ReactNode;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface ${glow ? "shadow-raised" : "shadow-card"} ${className}`}
    >
      {children}
    </div>
  );
}
