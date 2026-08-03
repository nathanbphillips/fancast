import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { loadAdminInsights } from "@/lib/db/adminInsights";
import { formatDuration } from "@/lib/formatDuration";
import { InsightsUsersTable } from "@/components/admin/InsightsUsersTable";

export const metadata: Metadata = { title: "Insights" };

function Kpi({
  value,
  label,
  sub,
}: {
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="display text-[28px] leading-none tabular-nums">{value}</div>
      <div className="mt-1.5 text-[13px] font-semibold text-primary">{label}</div>
      {sub && <div className="text-[11px] text-tertiary">{sub}</div>}
    </div>
  );
}

export default async function AdminInsightsPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!isAdmin(user?.id, profile)) redirect("/");

  const { kpis, growth, users, notes } = await loadAdminInsights();
  const maxSignups = Math.max(1, ...growth.map((g) => g.signups));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
          <p className="mt-1 text-sm text-secondary">
            A snapshot of who&apos;s signed up, how they&apos;re using it, and
            how it&apos;s growing.
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-raised"
        >
          ← Admin tools
        </Link>
      </div>

      {/* KPI snapshot */}
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi value={kpis.totalUsers} label="Registered users" sub={`+${kpis.new30d} in 30d`} />
        <Kpi value={`+${kpis.new7d}`} label="New this week" sub="last 7 days" />
        <Kpi value={kpis.active7d} label="Active this week" sub="signed in ≤7d" />
        <Kpi value={kpis.totalHosts} label="Hosts" sub={`${kpis.totalRooms} rooms total`} />
        <Kpi value={formatDuration(kpis.listeningSecondsAll)} label="Listening time" sub="everyone, all rooms" />
        <Kpi value={formatDuration(kpis.listeningSecondsRegistered)} label="By registered users" sub="of the above" />
        <Kpi value={kpis.totalMatchesAttended} label="Matches attended" sub="15+ min sessions" />
        <Kpi value={kpis.totalComments} label="Chat messages" sub="all time" />
      </section>

      {/* Growth */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-bold">Signups · last 30 days</h2>
          <span className="font-mono text-[11px] text-tertiary tabular-nums">
            {kpis.totalUsers} total
          </span>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex h-28 items-end gap-[3px]">
            {growth.map((g) => (
              <div
                key={g.date}
                className="group relative flex-1"
                title={`${g.date}: ${g.signups} signup${g.signups === 1 ? "" : "s"} · ${g.cumulative} total`}
              >
                <div
                  className="w-full rounded-t-sm bg-red/70 transition-colors group-hover:bg-red"
                  style={{
                    height: `${Math.max(g.signups === 0 ? 2 : 6, (g.signups / maxSignups) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-tertiary tabular-nums">
            <span>{growth[0]?.date}</span>
            <span>{growth[growth.length - 1]?.date}</span>
          </div>
        </div>
      </section>

      {/* Users */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-bold">Users</h2>
          <span className="font-mono text-[11px] text-tertiary">
            click a column to sort
          </span>
        </div>
        <InsightsUsersTable users={users} />
        {(notes.moreUsers || notes.truncatedSegments) && (
          <p className="mt-2 text-[11px] text-tertiary">
            {notes.moreUsers && "Showing the first 1,000 accounts. "}
            {notes.truncatedSegments &&
              "Listening totals sampled from the most recent sessions."}
          </p>
        )}
      </section>
    </div>
  );
}
