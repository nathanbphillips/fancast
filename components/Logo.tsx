import { brand } from "@/lib/brand";
import { LiveDot } from "@/components/ui/LiveDot";

/**
 * Brand mark (Cloud Design): a pulsing red live-dot + the wordmark in Anton
 * (all-caps display face). Pass `withWordmark={false}` for the dot alone.
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
        <span className="display text-[21px] tracking-[0.04em]">{brand.name}</span>
      )}
    </span>
  );
}
