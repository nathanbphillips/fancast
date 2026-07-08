import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { safeNextPath } from "@/lib/redirect";
import { SignInForm } from "@/components/SignInForm";
import { Logo } from "@/components/Logo";
import { EqBars } from "@/components/ui/EqBars";

export const metadata: Metadata = { title: "Sign in" };

// What an account unlocks (the mock's four value checks; all are real features).
const BENEFITS = [
  "Post in the room chat",
  "Vote in polls and rate the players",
  "Request the mic and call in",
  "Follow commentators for go-live alerts",
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (user && profile) redirect("/");
  if (user && !profile) redirect("/welcome");

  const { error, next: rawNext } = await searchParams;
  // sanitize here too; the auth callback re-validates before redirecting
  const next = rawNext ? safeNextPath(rawNext) : null;

  return (
    <div className="grid lg:min-h-[calc(100dvh-61px)] lg:grid-cols-[1.05fr_.95fr]">
      {/* value panel (desktop): brand · headline+benefits · ambient card */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-12 lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-40 -left-20 h-[620px] w-[760px] animate-fc-glow opacity-45 blur-3xl"
            style={{
              background:
                "radial-gradient(52% 56% at 40% 40%, rgba(239,1,7,0.2), transparent 72%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
              maskImage:
                "radial-gradient(60% 60% at 40% 40%, #000, transparent)",
              WebkitMaskImage:
                "radial-gradient(60% 60% at 40% 40%, #000, transparent)",
            }}
          />
        </div>

        {/* top: wordmark */}
        <Link
          href="/"
          aria-label={brand.name}
          className="relative z-[2] inline-flex w-fit"
        >
          <Logo />
        </Link>

        {/* middle: headline + value checks */}
        <div className="relative z-[2] max-w-md">
          <h1 className="display t-hero">
            Welcome to{" "}
            <span
              style={{
                background:
                  "linear-gradient(120deg,#ff2e28,#ef0107 55%,#b00206)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              the room
            </span>
            .
          </h1>
          <p className="mt-4 max-w-sm text-secondary">
            Listening is always free, no account needed. Sign in when you want
            to join in.
          </p>
          <ul className="mt-7 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-green/15 text-green"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12l4 4L19 6" />
                  </svg>
                </span>
                <span className="text-sm text-secondary">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* bottom: honest ambient card — no fabricated counts or match names */}
        <div
          className="relative z-[2] inline-flex w-fit items-center gap-3 rounded-[13px] border bg-surface px-4 py-3"
          style={{ borderColor: "rgba(239,1,7,.28)" }}
        >
          <span className="h-2.5 w-2.5 shrink-0 animate-fcpulse rounded-full bg-red" />
          <div>
            <div className="text-[13px] font-semibold">
              Rooms go live on matchday
            </div>
            <div className="font-mono text-[11px] text-secondary">
              Live fan audio, chat and stats, all in sync
            </div>
          </div>
          <EqBars className="ml-1" height={18} />
        </div>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center bg-inset px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm">
          {/* wordmark for mobile only (the left panel carries it on desktop) */}
          <Link
            href="/"
            aria-label={brand.name}
            className="inline-flex lg:hidden"
          >
            <Logo />
          </Link>
          <h2 className="display mt-8 t-h3 lg:mt-0">Sign in or join</h2>
          <p className="mt-2 text-sm text-secondary">
            New here? The same email link creates your account. Or continue with
            Google. No passwords either way.
          </p>
          <div className="mt-6">
            <SignInForm initialError={error} next={next} />
          </div>
          <p className="mt-6 text-xs text-secondary">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline hover:text-primary">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
          <p className="mt-4 text-center text-xs">
            <Link href="/" className="text-secondary hover:text-primary">
              ← Just listening? No account needed
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
