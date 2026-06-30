import type { ReactNode } from "react";

/**
 * Standard marketing section: a centred max-w-5xl block with an optional
 * gold-dot label, display heading, and intro line. Reuses the home page's
 * existing container + label patterns (no new CSS).
 */
export function Section({
  label,
  heading,
  sub,
  id,
  className = "",
  children,
}: {
  label?: string;
  heading?: ReactNode;
  sub?: ReactNode;
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`mx-auto max-w-5xl px-4 py-10 sm:py-14 ${className}`}
    >
      {label && (
        <p className="mb-2 flex items-center gap-2 font-display text-xs font-bold tracking-wider text-secondary uppercase">
          <span className="text-gold" aria-hidden="true">
            ●
          </span>
          {label}
        </p>
      )}
      {heading && (
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {heading}
        </h2>
      )}
      {sub && <p className="mt-3 max-w-2xl text-secondary sm:text-lg">{sub}</p>}
      {children}
    </section>
  );
}
