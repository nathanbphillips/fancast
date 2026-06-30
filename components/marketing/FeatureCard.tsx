import type { ReactNode } from "react";

/** Benefit card for the "why you'll stay" grid. */
export function FeatureCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border-[0.75px] border-line bg-surface p-5 shadow-card">
      <h3 className="font-display text-base font-bold">{title}</h3>
      <p className="mt-1.5 text-sm text-secondary">{children}</p>
    </div>
  );
}
