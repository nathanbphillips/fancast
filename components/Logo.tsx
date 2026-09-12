import { brand } from "@/lib/brand";
import { LiveDot } from "@/components/ui/LiveDot";

/**
 * Brand mark: a pulsing red live-dot + the wordmark.
 *
 * Programme redesign (founder 2026-09-12): one wordmark for both themes - the
 * two-tone lockup from `brand.logoParts` (ARSE in red, RADIO in the text
 * colour) set in Anton via `.display`. The dark-theme neon PNG is retired;
 * the programme is type, not glow. Pass `withWordmark={false}` for the dot
 * alone. `priority` is kept for call-site compatibility (nothing to preload
 * now that the mark is text).
 */
export function Logo({
  withWordmark = true,
  className = "",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  priority = false,
}: {
  withWordmark?: boolean;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LiveDot size={9} />
      {withWordmark && (
        <span className="display text-[21px] tracking-[0.04em]">
          <span className="text-red">{brand.logoParts.accent}</span>
          <span className="text-primary">{brand.logoParts.base}</span>
        </span>
      )}
    </span>
  );
}
