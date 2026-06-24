import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { SignInForm } from "@/components/SignInForm";

export const metadata: Metadata = { title: "Sign in" };

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
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        Sign in to {brand.name}
      </h1>
      <p className="mt-1 mb-6 text-sm text-secondary">
        Listening is open to everyone — an account lets you chat, vote, and
        follow commentators.
      </p>
      <SignInForm initialError={error} />
      <p className="mt-6 text-xs text-secondary">
        By signing in you agree to our{" "}
        <Link href="/terms" className="underline hover:text-primary">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-primary">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
