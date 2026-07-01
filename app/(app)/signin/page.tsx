import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { SignInForm } from "@/components/SignInForm";
import { Logo } from "@/components/Logo";
import { Pill } from "@/components/ui/Pill";

export const metadata: Metadata = { title: "Sign in" };

const BENEFITS = [
  "Chat with the room and reply to takes",
  "Vote in polls and rate the players",
  "Ask the commentator, or request the mic",
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (user && profile) redirect("/");
  if (user && !profile) redirect("/welcome");

  const { error } = await searchParams;

  return (
    <div className="grid lg:min-h-[calc(100dvh-61px)] lg:grid-cols-[1.05fr_.95fr]">
      {/* value panel (desktop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-14 lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-20 -left-10 h-96 w-96 rounded-full opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(241,35,43,0.2), transparent 70%)",
            }}
          />
        </div>
        <div className="relative">
          <Pill variant="red" live>
            Live every match
          </Pill>
        </div>
        <div className="relative">
          <h1 className="display text-6xl leading-[0.9]">Pull up a seat.</h1>
          <p className="mt-4 max-w-sm text-secondary">
            Sign up to join in. It takes under a minute, and lets you chat, vote,
            and call in.
          </p>
          <ul className="mt-8 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gold text-inverted-fg"
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
                <span className="text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-[11px] tracking-wider text-secondary uppercase">
          No pundits · No fluff · Just football
        </p>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center bg-inset px-6 py-16 sm:px-10">
        <div className="w-full max-w-sm">
          <Link href="/" aria-label={brand.name} className="inline-flex">
            <Logo />
          </Link>
          <h2 className="display mt-8 text-3xl">Sign in or join</h2>
          <p className="mt-2 text-sm text-secondary">
            Enter your email and we&apos;ll send a one-tap link. No passwords.
          </p>
          <div className="mt-6">
            <SignInForm initialError={error} />
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
              ← Just browsing? Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
