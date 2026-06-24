import Link from "next/link";
import { brand } from "@/lib/brand";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { PWASetup } from "@/components/PWASetup";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeSync } from "@/components/ThemeSync";
import { ToastProvider } from "@/components/Toast";
import { UserMenu } from "@/components/UserMenu";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await getCurrentUserAndProfile();

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col">
        <ThemeSync themePref={profile?.theme_pref ?? null} />
        <PWASetup />
        <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <Link
              href="/"
              className="flex h-11 items-center rounded-lg px-1 text-lg font-semibold tracking-tight"
            >
              {brand.name}
            </Link>
            <div className="flex items-center gap-1">
              {profile ? (
                <UserMenu username={profile.username} />
              ) : user ? (
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
        <main className="flex-1">{children}</main>
      </div>
    </ToastProvider>
  );
}
