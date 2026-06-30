"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/Logo";

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
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-xs">
              {brand.name} is an unofficial, fan-made platform and is not
              affiliated with or endorsed by any club, league, or broadcaster.
            </p>
          </div>
          <div className="flex gap-12">
            <nav className="flex flex-col gap-2" aria-label="Platform">
              <p className="font-display text-xs font-bold tracking-wider text-primary uppercase">
                Platform
              </p>
              <Link href="/" className="hover:text-primary">
                Matches
              </Link>
            </nav>
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
        </div>
        <div className="mt-8 flex flex-col gap-1 border-t border-line pt-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-green"
            />
            All systems go
          </p>
        </div>
      </div>
    </footer>
  );
}
