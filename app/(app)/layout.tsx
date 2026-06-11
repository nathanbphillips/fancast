import Link from "next/link";
import { brand } from "@/lib/brand";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex h-11 items-center rounded-lg px-1 text-lg font-semibold tracking-tight"
          >
            {brand.name}
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
