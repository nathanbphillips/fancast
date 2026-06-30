import Link from "next/link";
import type { ReactNode } from "react";

/** Shared marketing CTAs so the home/about pages don't repeat class strings.
 *  Primary = red solid; Secondary = gold outline. Both 44px tall. */

export function PrimaryCta({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center rounded-lg bg-red px-5 text-sm font-semibold text-white"
    >
      {children}
    </Link>
  );
}

export function SecondaryCta({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center rounded-lg border border-gold px-5 text-sm font-semibold text-gold hover:bg-raised"
    >
      {children}
    </Link>
  );
}
