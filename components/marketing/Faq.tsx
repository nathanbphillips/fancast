import type { ReactNode } from "react";

/** Collapsible FAQ list using native <details> (no JS). */
export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="mt-6 space-y-2">
      {items.map((it, i) => (
        <details
          key={i}
          className="group rounded-xl border-[0.75px] border-line bg-surface p-4 shadow-card"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
            {it.q}
            <span
              aria-hidden="true"
              className="shrink-0 text-lg leading-none text-secondary transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="mt-2 text-sm text-secondary">{it.a}</div>
        </details>
      ))}
    </div>
  );
}
