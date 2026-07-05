"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/matches", label: "Matches" },
  { href: "/about", label: "About" },
];

/**
 * Sticky top nav (Cloud Design). Self-hides inside the immersive room
 * (/room/[id]) — the room renders its own bar. Auth state is computed
 * server-side and passed as props (no-flash / server-auth model).
 */
export function AppHeader({
  username,
  avatarUrl,
  admin,
  host = false,
  userExists,
  liveCount,
}: {
  username: string | null;
  avatarUrl: string | null;
  admin: boolean;
  /** commentator or admin: can host rooms (FR-19) */
  host?: boolean;
  userExists: boolean;
  liveCount: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // close the mobile menu on navigation and on Escape
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (pathname?.startsWith("/room/")) return null;

  const navLink =
    "text-[13.5px] font-semibold text-secondary transition-colors hover:text-primary";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-[61px] max-w-[1180px] items-center justify-between px-5 sm:px-10">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label={brand.name} className="flex items-center">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={navLink}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {liveCount > 0 && (
            <Link href="/matches" className="hidden sm:block" aria-label={`${liveCount} live now`}>
              <Pill variant="red" live>
                {liveCount} LIVE
              </Pill>
            </Link>
          )}
          <ThemeToggle />
          {username ? (
            <UserMenu
              username={username}
              avatarUrl={avatarUrl}
              admin={admin}
              host={host}
            />
          ) : userExists ? (
            <Button href="/welcome" variant="inverted" size="sm">
              Pick a username
            </Button>
          ) : (
            <Button href="/signin" variant="inverted" size="sm">
              Sign in
            </Button>
          )}
          {/* mobile menu toggle — the primary nav is desktop-only otherwise */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-raised hover:text-primary md:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              {menuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="7" x2="21" y2="7" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="17" x2="21" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-line bg-canvas md:hidden"
        >
          <div className="mx-auto flex max-w-[1180px] flex-col px-5 py-1 sm:px-10">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="border-b border-line/60 py-3.5 text-[15px] font-semibold text-primary last:border-b-0"
              >
                {n.label}
              </Link>
            ))}
            {liveCount > 0 && (
              <Link
                href="/matches"
                className="flex items-center gap-2 py-3.5 text-[15px] font-semibold text-red"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-red"
                />
                {liveCount} live now
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
