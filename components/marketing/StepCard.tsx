import type { ReactNode } from "react";

/** Numbered "how it works" step card. */
export function StepCard({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border-[0.75px] border-line bg-surface p-5 shadow-card">
      <span className="font-display text-2xl font-bold text-gold tabular-nums">
        {n}
      </span>
      <h3 className="mt-2 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-secondary">{children}</p>
    </div>
  );
}
