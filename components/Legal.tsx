import type { ReactNode } from "react";

/**
 * Shared chrome for the static legal pages (docs/LEGAL_PAGES.md is the source
 * of truth). `Ph` renders a founder placeholder ([BRACKETED] in the source)
 * visibly highlighted so it can't ship to a public session unfilled.
 */

export function LegalShell({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="display t-h2 border-b-[3px] border-double border-primary pb-4">
        {title}
      </h1>
      {lede && <p className="mt-3 text-secondary italic">{lede}</p>}
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-secondary">
        {children}
      </div>
    </article>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-b border-line pt-2 pb-1.5 font-mono text-[13px] font-bold tracking-[0.1em] text-red uppercase">
      {children}
    </h2>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-primary">{children}</strong>;
}

/** A founder placeholder — fill before the first public session. */
export function Ph({ children }: { children: ReactNode }) {
  return (
    <mark
      title="Founder placeholder - fill before launch"
      className="bg-red/20 px-1 font-medium text-red"
    >
      {children}
    </mark>
  );
}
