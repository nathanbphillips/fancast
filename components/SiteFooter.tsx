"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/Logo";

/**
 * Site footer (Cloud Design): logo + the unaffiliated-platform disclaimer
 * (docs/LEGAL_PAGES.md) + Platform/Legal columns. Self-hides inside the room.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/room/")) return null;

  const link = "text-sm text-secondary transition-colors hover:text-primary";
  const heading =
    "font-mono text-[11px] font-bold tracking-[0.14em] text-secondary uppercase";

  return (
    <footer className="border-t border-line bg-footer">
      <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-10">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm text-secondary">
              {brand.name} is an unofficial, fan-made platform and is not
              affiliated with or endorsed by any club, league, or broadcaster.
            </p>
          </div>
          <div className="flex gap-16">
            <nav className="flex flex-col gap-3" aria-label="Platform">
              <p className={heading}>Platform</p>
              <Link href="/matches" className={link}>
                Matches
              </Link>
              <Link href="/about" className={link}>
                About
              </Link>
              <Link href="/signin" className={link}>
                Sign in
              </Link>
            </nav>
            <nav className="flex flex-col gap-3" aria-label="Legal">
              <p className={heading}>Legal</p>
              <Link href="/guidelines" className={link}>
                Community Guidelines
              </Link>
              <Link href="/terms" className={link}>
                Terms of Service
              </Link>
              <Link href="/privacy" className={link}>
                Privacy Policy
              </Link>
            </nav>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 font-mono text-[11px] tracking-wider text-secondary uppercase sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.name}
          </p>
          <p>No pundits · No fluff · Just football</p>
        </div>
      </div>
    </footer>
  );
}
