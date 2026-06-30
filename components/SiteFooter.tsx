"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/brand";

/**
 * Site footer: the unaffiliated-platform disclaimer (docs/LEGAL_PAGES.md) plus
 * links to the three legal pages. Self-hides inside the immersive room, which
 * owns the full viewport and its own bottom audio bar.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/room/")) return null;

  return (
    <footer className="border-t border-line px-4 py-10 text-sm text-secondary">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-base font-bold text-primary">
              {brand.name}
            </p>
            <p className="mt-2 text-xs">
              {brand.name} is an unofficial, fan-made platform and is not
              affiliated with or endorsed by any club, league, or broadcaster.
            </p>
          </div>
          <nav className="flex flex-col gap-2" aria-label="Legal">
            <p className="font-display text-xs font-bold tracking-wider text-primary uppercase">
              Legal
            </p>
            <Link href="/guidelines" className="hover:text-primary">
              Community Guidelines
            </Link>
            <Link href="/terms" className="hover:text-primary">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-primary">
              Privacy Policy
            </Link>
          </nav>
        </div>
        <p className="mt-8 border-t border-line pt-4 text-xs">
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
