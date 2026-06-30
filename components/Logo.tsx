import { brand } from "@/lib/brand";

/**
 * Brand mark (redesign): a pulse/activity glyph in a rounded square + the
 * wordmark. Theme-aware — dark square on light canvas, light square on dark —
 * via the primary/canvas tokens, so it reads in both themes. Pass
 * `withWordmark={false}` for the icon alone.
 */
export function Logo({
  withWordmark = true,
  className = "",
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-canvas">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12h3.5l2 6 4-15 2.5 9H21" />
        </svg>
      </span>
      {withWordmark && (
        <span className="font-display text-lg font-bold tracking-tight">
          {brand.name}
        </span>
      )}
    </span>
  );
}
