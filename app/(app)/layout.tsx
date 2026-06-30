import { getCurrentUserAndProfile } from "@/lib/db/server";
import { PWASetup } from "@/components/PWASetup";
import { ThemeSync } from "@/components/ThemeSync";
import { SiteFooter } from "@/components/SiteFooter";
import { ToastProvider } from "@/components/Toast";
import { AppHeader } from "@/components/AppHeader";
import { isAdmin } from "@/lib/roles";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await getCurrentUserAndProfile();
  const admin = isAdmin(user?.id, profile);

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col">
        <ThemeSync themePref={profile?.theme_pref ?? null} />
        <PWASetup />
        <AppHeader
          username={profile?.username ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          admin={admin}
          userExists={!!user}
        />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </ToastProvider>
  );
}
