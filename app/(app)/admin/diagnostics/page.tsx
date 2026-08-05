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
  AdminDiagnostics,
  type DiagRow,
} from "@/components/admin/AdminDiagnostics";

/** Every event that represents something GOING WRONG. Product-analytics events
 *  (room_view, listen_started…) are deliberately excluded. Add new fault events
 *  here and they render with full context automatically. */
const DIAGNOSTIC_EVENTS = [
  "client_error", // uncaught errors, rejections, failed/unreachable API calls
  "callin_mic_failed",
  "callin_mic_timeout",
  "audio_connect_failed",
];

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

  const { data: diagRows } = await service
    .from("events")
    .select("id, created_at, event, user_id, session_id, room_id, path, props")
    .in("event", DIAGNOSTIC_EVENTS)
    .order("created_at", { ascending: false })
    .limit(400);
  const diagnostics = (diagRows ?? []) as DiagRow[];

  // resolve who hit each fault — "which user, on which device" is the question
  // you actually ask when something breaks
  const userIds = [
    ...new Set(diagnostics.map((d) => d.user_id).filter(Boolean)),
  ] as string[];
  const usernames: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profs } = await service
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);
    for (const p of profs ?? []) {
      usernames[p.user_id as string] = p.username as string;
    }
  }

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
        <h2 className="text-sm font-bold">Faults</h2>
        <p className="text-xs text-secondary">
          Failed API calls (with the server&apos;s reason), uncaught errors,
          promise rejections, and audio / call-in faults — each with the user,
          device, page and room it happened on.
        </p>
        <AdminDiagnostics initial={diagnostics} usernames={usernames} />
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
