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
      <div className="relative hidden flex-col justify-between border-r border-line p-12 lg:flex">
        {/* top: wordmark */}
        <Link
          href="/"
          aria-label={brand.name}
          className="inline-flex w-fit"
        >
          <Logo />
        </Link>

        {/* middle: headline + value checks */}
        <div className="max-w-md">
          <h1 className="display t-hero">
            Welcome to <span className="text-red">the room</span>.
          </h1>
          <p className="mt-4 max-w-sm text-secondary italic">
            Listening is always free, no account needed. Sign in when you want
            to join in.
          </p>
          <ul className="mt-7 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center border border-green text-green"
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
        <div className="inline-flex w-fit items-center gap-3 border border-red px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 animate-fcpulse rounded-full bg-red-fill" />
          <div>
            <div className="text-[13px] font-semibold">
              Rooms go live on matchday
            </div>
            <div className="text-[11px] text-secondary italic">
              Live fan audio, chat and stats, all in sync
            </div>
          </div>
          <EqBars className="ml-1" height={18} />
        </div>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center bg-canvas px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm">
          {/* wordmark for mobile only (the left panel carries it on desktop) */}
          <Link
            href="/"
            aria-label={brand.name}
            className="inline-flex lg:hidden"
          >
            <Logo />
          </Link>
          <p className="mt-8 font-mono text-[12px] tracking-[0.1em] text-red uppercase lg:mt-0">
            The subscription desk
          </p>
          <h2 className="display mt-2 t-h3">Sign in</h2>
          <p className="mt-2 text-sm text-secondary italic">
            Listening is free and needs no account - this page is for joining
            in.
          </p>
          <div className="mt-6 border-2 border-primary bg-inset p-8 outline outline-1 outline-primary outline-offset-[5px]">
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
