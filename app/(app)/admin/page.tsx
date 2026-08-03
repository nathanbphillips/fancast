import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  createServiceClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { AdminTools } from "@/components/admin/AdminTools";
import { AdminGuide } from "@/components/admin/AdminGuide";
import { AdminBugs, type BugRow } from "@/components/admin/AdminBugs";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!isAdmin(user?.id, profile)) redirect("/");

  const service = createServiceClient();
  const { data: bugRows } = await service
    .from("bug_reports")
    .select(
      "id, created_at, username, room_id, room_state, category, description, path, viewport, user_agent, status",
    )
    .order("status", { ascending: false }) // open before closed
    .order("created_at", { ascending: false })
    .limit(100);
  const bugs = (bugRows ?? []) as BugRow[];

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-secondary">
        Spin up a room for any game — a World Cup match, a friendly, anything.
      </p>
      <AdminTools />

      <section className="mt-8">
        <h2 className="text-sm font-bold">Bug reports</h2>
        <AdminBugs initial={bugs} />
      </section>

      <AdminGuide />
    </div>
  );
}
