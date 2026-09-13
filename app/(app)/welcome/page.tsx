import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { safeNextPath } from "@/lib/redirect";
import { UsernameForm } from "@/components/UsernameForm";

export const metadata: Metadata = { title: "Pick a username" };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext ?? null);
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/signin");
  if (profile) redirect(next);

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="display t-h3 border-b-[3px] border-double border-primary pb-3">
        Welcome to {brand.name}
      </h1>
      <p className="mt-3 mb-6 text-sm text-secondary italic">
        One last thing - pick the name the room will know you by.
      </p>
      <UsernameForm mode="create" next={next} />
    </div>
  );
}
