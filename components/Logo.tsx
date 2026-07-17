import Image from "next/image";
import { brand } from "@/lib/brand";
import { LiveDot } from "@/components/ui/LiveDot";

/**
 * Brand mark: a pulsing red live-dot + the wordmark.
 *
 * Theme-aware (founder 2026-07-17): the neon logo image on the DARK theme (the
 * default everyone sees first), and the two-tone CSS wordmark from
 * `brand.logoParts` on the LIGHT theme — where the neon glow would wash out and
 * "RADIO" (a faint outline in the artwork) would vanish. Exactly one variant is
 * ever in the DOM/a11y tree per theme (the other is `display:none`); both carry
 * `brand.name`. Pass `withWordmark={false}` for the dot alone; `priority` for
 * the above-the-fold nav mark.
 */
export function Logo({
  withWordmark = true,
  className = "",
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
        <>
          {/* light theme: legible two-tone wordmark (ARSE red / RADIO foreground) */}
          <span className="display text-[21px] tracking-[0.04em] uppercase dark:hidden">
            <span className="text-red">{brand.logoParts.accent}</span>
            <span className="text-primary">{brand.logoParts.base}</span>
          </span>
          {/* dark theme (default): the neon logo artwork */}
          <Image
            src="/brand/arseradio-neon.png"
            alt={brand.name}
            width={1440}
            height={300}
            priority={priority}
            className="hidden h-[30px] w-auto dark:block"
          />
        </>
      )}
    </span>
  );
}
