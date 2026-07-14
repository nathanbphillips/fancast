import { brand } from "@/lib/brand";
import { LiveDot } from "@/components/ui/LiveDot";

/**
 * Brand mark: a pulsing red live-dot + the two-tone uppercase wordmark
 * (ARSE in red, RADIO in the foreground colour, from `brand.logoParts`).
 * RADIO uses `text-primary` so it reads white on the dark theme (as designed)
 * and stays legible on the light theme instead of vanishing. Pass
 * `withWordmark={false}` for the dot alone.
 */
export function Logo({
  withWordmark = true,
  className = "",
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LiveDot size={9} />
      {withWordmark && (
        <span className="display text-[21px] tracking-[0.04em] uppercase">
          <span className="text-red">{brand.logoParts.accent}</span>
          <span className="text-primary">{brand.logoParts.base}</span>
        </span>
      )}
    </span>
  );
}
