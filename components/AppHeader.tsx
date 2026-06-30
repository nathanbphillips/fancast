"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

/**
 * App top nav. Self-hides inside the immersive room (/room/[id]) — mirroring
 * SiteFooter — because the room renders its own combined top bar (wordmark ·
 * score · live · listeners · theme · menu). Auth state is computed server-side
 * and passed in as props, preserving the no-flash / server-auth model even
 * though the path check forces this to be a client component.
 */
export function AppHeader({
  username,
  avatarUrl,
  admin,
  userExists,
}: {
  username: string | null;
  avatarUrl: string | null;
  admin: boolean;
  userExists: boolean;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith("/room/")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          aria-label={brand.name}
          className="flex h-11 items-center rounded-lg px-1"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          {username ? (
            <UserMenu username={username} avatarUrl={avatarUrl} admin={admin} />
          ) : userExists ? (
            <Link
              href="/welcome"
              className="flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-gold hover:bg-raised"
            >
              Pick a username
            </Link>
          ) : (
            <Link
              href="/signin"
              className="flex h-11 items-center rounded-lg px-3 text-sm font-semibold hover:bg-raised"
            >
              Sign in
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
