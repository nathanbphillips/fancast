"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";

/**
 * Sticky top nav (Cloud Design). Self-hides inside the immersive room
 * (/room/[id]) — the room renders its own bar. Auth state is computed
 * server-side and passed as props (no-flash / server-auth model).
 */
export function AppHeader({
  username,
  avatarUrl,
  admin,
  userExists,
  liveCount,
}: {
  username: string | null;
  avatarUrl: string | null;
  admin: boolean;
  userExists: boolean;
  liveCount: number;
}) {
  const pathname = usePathname();
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
            <Link href="/#how" className={navLink}>
              How it works
            </Link>
            <Link href="/matches" className={navLink}>
              Matches
            </Link>
            <Link href="/about" className={navLink}>
              About
            </Link>
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
            <UserMenu username={username} avatarUrl={avatarUrl} admin={admin} />
          ) : userExists ? (
            <Button href="/welcome" variant="inverted" size="sm">
              Pick a username
            </Button>
          ) : (
            <Button href="/signin" variant="inverted" size="sm">
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
