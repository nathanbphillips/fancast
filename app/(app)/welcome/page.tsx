import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { UsernameForm } from "@/components/UsernameForm";

export const metadata: Metadata = { title: "Pick a username" };

export default async function WelcomePage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/signin");
  if (profile) redirect("/");

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        Welcome to {brand.name}
      </h1>
      <p className="mt-1 mb-6 text-sm text-secondary">
        One last thing — pick the name the room will know you by.
      </p>
      <UsernameForm mode="create" />
    </div>
  );
}
