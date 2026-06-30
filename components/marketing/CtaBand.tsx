import type { ReactNode } from "react";

/** Full-width closing call-to-action panel. */
export function CtaBand({
  heading,
  line,
  cta,
  note,
}: {
  heading: string;
  line: ReactNode;
  cta: ReactNode;
  note?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <div className="rounded-2xl border-[0.75px] border-line bg-raised p-8 text-center shadow-card sm:p-12">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-secondary">{line}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">{cta}</div>
        {note && <p className="mt-4 text-xs text-secondary">{note}</p>}
      </div>
    </section>
  );
}
