import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { safeNextPath } from "@/lib/redirect";
import { SignInForm } from "@/components/SignInForm";
import { PageMasthead, PageTitle } from "@/components/marketing/PageMasthead";

/**
 * Page 4: SIGN IN (Programme redesign - the mock's page, layout and copy,
 * founder 2026-09-13). Subpage masthead -> title block -> the double-framed
 * coupon (magic-link flow + Google, both real) -> WHAT AN ACCOUNT UNLOCKS
 * definition grid -> the just-listening line. Auth logic untouched.
 */

export const metadata: Metadata = { title: "Sign in" };

const UNLOCKS: [string, React.ReactNode][] = [
  ["Chat", "Post, reply, vote - reading never needs an account."],
  ["RSVP", "Save your seat for upcoming rooms, bring your friends."],
  [
    "Follow",
    "A nudge when your commentators schedule or go live - you choose which alerts reach you.",
  ],
  ["Call in", "Request the mic and get brought on air."],
  [
    "Host",
    <>
      Run your own room - no platform fee, the show is yours.{" "}
      <Link href="/host" className="border-b border-red whitespace-nowrap hover:text-red">
        See page 3 →
      </Link>
    </>,
  ],
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
    <div className="mx-auto max-w-[1000px] px-5 pt-6 pb-14 sm:px-10">
      <PageMasthead page={4} />
      <PageTitle
        kicker="The subscription desk"
        title="Sign in"
        standfirst="Listening is free and needs no account - this page is for joining in."
      />

      {/* THE COUPON (double frame) */}
      <div className="mx-auto mt-8 max-w-[620px] border-2 border-primary bg-inset p-7 outline outline-1 outline-primary outline-offset-[5px] sm:p-8">
        <SignInForm initialError={error} next={next} />
      </div>
      <p className="mx-auto mt-5 max-w-[620px] text-center text-xs text-secondary">
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

      {/* WHAT AN ACCOUNT UNLOCKS */}
      <div className="mt-11">
        <h2 className="display border-b-[3px] border-double border-primary pb-2.5 text-center text-[28px]">
          What an account unlocks
        </h2>
        <div className="mx-auto mt-5 grid max-w-[720px] gap-x-5 gap-y-3.5 text-[16.5px] leading-[1.6] sm:grid-cols-[170px_1fr]">
          {UNLOCKS.map(([label, copy]) => (
            <div key={label} className="contents">
              <span className="font-mono text-[15px] font-semibold tracking-[0.1em]">
                {label}
              </span>
              <span className="mb-2 text-secondary sm:mb-0">{copy}</span>
            </div>
          ))}
        </div>
        <p className="mt-7 text-center text-[16px] italic">
          Just here to listen? No sign-in needed -{" "}
          <Link href="/" className="border-b border-red not-italic whitespace-nowrap hover:text-red">
            back to the fixtures →
          </Link>
        </p>
      </div>
    </div>
  );
}
