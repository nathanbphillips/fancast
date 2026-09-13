import Link from "next/link";
import { brand } from "@/lib/brand";

/**
 * Subpage masthead strip (Programme pages 2-4): back link to the front page,
 * the programme's name in the centre, the page number on the right. Pure
 * chrome, matching the handoff's subpage treatment.
 */
export function PageMasthead({ page }: { page: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t-[3px] border-t-primary border-b border-b-primary py-2 font-mono text-[13px] tracking-[0.06em] text-primary">
      <Link href="/" className="whitespace-nowrap hover:text-red">
        ← Back to fixtures p.1
      </Link>
      <span className="hidden whitespace-nowrap sm:inline">
        {brand.name} · the matchday programme
      </span>
      <span className="whitespace-nowrap">Page {page}</span>
    </div>
  );
}

/**
 * Subpage title block: red kicker, Anton title, italic standfirst, closed by
 * a hairline rule.
 */
export function PageTitle({
  kicker,
  title,
  standfirst,
}: {
  kicker: string;
  title: string;
  standfirst: React.ReactNode;
}) {
  return (
    <div className="border-b border-primary pt-9 pb-6 text-center">
      <p className="font-mono text-[14px] tracking-[0.18em] text-red">{kicker}</p>
      <h1 className="display mt-2.5 text-[clamp(48px,7vw,76px)] leading-[0.95]">
        {title}
      </h1>
      <p className="mx-auto mt-3.5 max-w-[640px] text-[19px] leading-[1.55] text-secondary italic">
        {standfirst}
      </p>
    </div>
  );
}
