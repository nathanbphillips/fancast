"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/Button";
import { MastheadStrip } from "@/components/marketing/MastheadStrip";
import { DEMO_ROOM_HREF } from "@/lib/config";

type NavItem = { href: string; label: string };
type NavEntry = NavItem | { label: string; children: NavItem[] };

// Programme nav (founder 2026-09-23): Fixtures · Extra Extra! (the About
// page) · Host · View demo, then the theme toggle and auth. How it works lives
// in the footer.
const NAV: NavEntry[] = [
  { href: "/matches", label: "Fixtures" },
  { href: "/about", label: "Extra Extra!" },
  { href: "/host", label: "Host" },
  { href: DEMO_ROOM_HREF, label: "View demo" },
];

/** Desktop nav dropdown (hover + click + keyboard). Groups secondary links
 *  (About / Host / Creators) under one "Learn More" trigger. */
function NavDropdown({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // close on outside click / Escape while open
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const anyActive = items.some((i) => pathname?.startsWith(i.href));

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 font-mono text-[13.5px] font-semibold tracking-[0.08em] transition-colors ${
          anyActive ? "text-primary" : "text-secondary hover:text-red"
        }`}
      >
        {label}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-50 pt-2">
          <div className="min-w-[168px] border-2 border-primary bg-canvas p-1.5">
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                role="menuitem"
                aria-current={pathname?.startsWith(i.href) ? "page" : undefined}
                className={`block px-3 py-2 font-mono text-[13.5px] font-semibold tracking-[0.08em] transition-colors ${
                  pathname?.startsWith(i.href)
                    ? "bg-raised text-primary"
                    : "text-secondary hover:bg-raised hover:text-primary"
                }`}
              >
                {i.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sticky top nav. The programme masthead strip (Vol · date · Price) sits
 * above it at the very top of every page and scrolls away naturally while
 * the nav stays sticky (founder 2026-09-22 - replaced the early-access
 * announcement bar). Self-hides inside the immersive room (/room/[id]) — the
 * room renders its own masthead. Auth state is server-computed and passed as
 * props (no-flash / server-auth model).
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

  // programme nav voice: Newsreader small caps, gently tracked (font-mono is
  // the small-caps utility since the Programme redesign)
  const navLink =
    "font-mono text-[13.5px] font-semibold tracking-[0.08em] text-secondary transition-colors hover:text-red";
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      {/* the programme masthead at the very top; in normal flow, so it
          scrolls away while the nav below stays sticky (founder 2026-09-22) */}
      <MastheadStrip />

      {/* nav keeps the 1px bottom rule; the 3px page-top rule now lives on
          the masthead strip above */}
      <header className="sticky top-0 z-40 border-b border-b-primary bg-canvas">
        <div className="mx-auto flex h-[61px] max-w-[1260px] items-center justify-between px-5 sm:px-10">
          <div className="flex items-center">
            <Link href="/" aria-label={brand.name} className="flex items-center">
              <Logo priority />
            </Link>
          </div>
          <div className="flex items-center gap-4 sm:gap-5">
            <nav
              className="hidden items-center gap-6 md:flex"
              aria-label="Primary"
            >
              {NAV.map((n) =>
                "children" in n ? (
                  <NavDropdown
                    key={n.label}
                    label={n.label}
                    items={n.children}
                    pathname={pathname}
                  />
                ) : (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={isActive(n.href) ? "page" : undefined}
                    className={
                      isActive(n.href)
                        ? "font-mono text-[13.5px] font-semibold tracking-[0.08em] text-primary"
                        : navLink
                    }
                  >
                    {n.label}
                  </Link>
                ),
              )}
            </nav>
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
              <>
                <Link
                  href="/signin"
                  className={`hidden sm:block ${navLink}`}
                >
                  Sign in
                </Link>
                <Button href="/signin" variant="red" size="sm">
                  Get matchday alerts
                </Button>
              </>
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
              {NAV.map((n) =>
                "children" in n ? (
                  <div
                    key={n.label}
                    className="border-b border-line/60 py-2 last:border-b-0"
                  >
                    <span className="block py-1.5 font-mono text-[11px] font-bold tracking-[0.1em] text-tertiary uppercase">
                      {n.label}
                    </span>
                    {n.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className="block py-2.5 pl-3 text-[15px] font-semibold text-primary"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="border-b border-line/60 py-3.5 text-[15px] font-semibold text-primary last:border-b-0"
                  >
                    {n.label}
                  </Link>
                ),
              )}
              {!username && (
                <Link
                  href="/signin"
                  className="border-t border-line/60 py-3.5 text-[15px] font-semibold text-secondary"
                >
                  Sign in
                </Link>
              )}
              {liveCount > 0 && (
                <Link
                  href="/matches"
                  className="flex items-center gap-2 py-3.5 text-[15px] font-semibold text-red"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 animate-fc-blink rounded-full bg-red-fill"
                  />
                  {liveCount} live now
                </Link>
              )}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
