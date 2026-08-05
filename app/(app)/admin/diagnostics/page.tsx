import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createServiceClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { AdminBugs, type BugRow } from "@/components/admin/AdminBugs";
import {
  AdminClientErrors,
  type ClientErrorRow,
} from "@/components/admin/AdminClientErrors";

export const metadata: Metadata = { title: "Diagnostics" };

/**
 * Admin diagnostics (2026-08-05): bug reports + client-side errors on their own
 * page, with the fullest device + environment picture (parsed browser/OS/device,
 * viewport vs screen, pixel ratio, network, memory, cores, language, platform,
 * online, session) so a live-test failure can be pinned to the exact device.
 */
export default async function DiagnosticsPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!isAdmin(user?.id, profile)) redirect("/");

  const service = createServiceClient();

  const { data: errorRows } = await service
    .from("events")
    .select("id, created_at, path, session_id, props")
    .eq("event", "client_error")
    .order("created_at", { ascending: false })
    .limit(300);
  const clientErrors = (errorRows ?? []) as ClientErrorRow[];

  const { data: bugRows } = await service
    .from("bug_reports")
    .select(
      "id, created_at, username, room_id, room_state, category, description, path, viewport, user_agent, status",
    )
    .order("status", { ascending: false }) // open before closed
    .order("created_at", { ascending: false })
    .limit(200);
  const bugs = (bugRows ?? []) as BugRow[];

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-secondary transition-colors hover:text-primary"
      >
        ← Admin
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Diagnostics</h1>
      <p className="mt-1 text-sm text-secondary">
        Bug reports and client-side errors, with full device + environment info
        for the live test.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-bold">Client errors</h2>
        <p className="text-xs text-secondary">
          Uncaught JS errors + promise rejections from listeners&apos; browsers,
          with the device and environment that hit them.
        </p>
        <AdminClientErrors initial={clientErrors} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-bold">Bug reports</h2>
        <p className="text-xs text-secondary">
          Submitted from the in-room bug button, with the reporter&apos;s device.
        </p>
        <AdminBugs initial={bugs} />
      </section>
    </div>
  );
}
