import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { AdminTools } from "@/components/admin/AdminTools";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!isAdmin(user?.id, profile)) redirect("/");

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-secondary">
        Spin up a room for any game — a World Cup match, a friendly, anything.
      </p>
      <AdminTools />
    </div>
  );
}
