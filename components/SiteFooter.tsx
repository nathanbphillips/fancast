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
    <footer className="border-t border-line px-4 py-6 text-xs text-secondary">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md">
          {brand.name} is an unofficial, fan-made platform and is not affiliated
          with or endorsed by any club, league, or broadcaster.
        </p>
        <nav className="flex gap-4" aria-label="Legal">
          <Link href="/guidelines" className="hover:text-primary">
            Guidelines
          </Link>
          <Link href="/terms" className="hover:text-primary">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-primary">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
