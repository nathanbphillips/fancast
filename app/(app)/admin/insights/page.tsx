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

  const { kpis, funnel, retention, growth, users, rooms, events, notes } =
    await loadAdminInsights();
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
        <Kpi
          value={kpis.alertSignups}
          label="Matchday-alert signups"
          sub={`+${kpis.alertSignups7d} in 7d`}
        />
        <Kpi
          value={kpis.rsvpsTotal}
          label="Room RSVPs"
          sub={`${kpis.rsvpUsers} people · +${kpis.rsvps7d} in 7d`}
        />
      </section>

      {/* Funnel & retention */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold">Funnel &amp; retention</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            value={`${funnel.conversionPct}%`}
            label="Onboarding completion"
            sub={`${funnel.completedProfiles}/${funnel.authAccounts} finished signup`}
          />
          <Kpi
            value={funnel.onboardingDropoff}
            label="Stuck in onboarding"
            sub="signed in, no username"
          />
          <Kpi
            value={`${retention.returnedRate}%`}
            label="Returned"
            sub={`${retention.returnedCount} came back a later day`}
          />
          <Kpi
            value={`${retention.week1Rate}%`}
            label="Week-1 return"
            sub="listened again within 7d"
          />
        </div>
        <p className="mt-2 text-[11px] text-tertiary">
          Returned = signed in on a later day than signup. Fuller cohort curves
          fill in as the events log accumulates.
        </p>
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

      {/* Rooms */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold">Rooms · recent {rooms.length}</h2>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-raised/50 font-mono text-[11px] tracking-[0.04em] text-secondary uppercase">
                <th className="px-3 py-2">Room</th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2 text-right">Listeners</th>
                <th className="px-3 py-2 text-right">Peak</th>
                <th className="px-3 py-2 text-right">Avg session</th>
                <th className="px-3 py-2 text-right">Call-ins</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.roomId} className="border-b border-line/60 last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="font-semibold text-primary">{r.name}</span>
                    <span className="ml-2 rounded-full bg-raised px-1.5 py-0.5 font-mono text-[9px] tracking-[0.04em] text-secondary uppercase">
                      {r.state}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-secondary tabular-nums">
                    {r.whenIso.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.uniqueListeners}
                    {r.anonSessions > 0 && (
                      <span className="text-tertiary"> +{r.anonSessions}a</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.peakConcurrent}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                    {formatDuration(r.avgSessionSecs)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.callIns}</td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-secondary">
                    No rooms yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-tertiary">
          Listeners = distinct signed-in accounts (+ Na anonymous sessions);
          peak = max simultaneous; call-ins = times a listener went on air.
        </p>
      </section>

      {/* Events (product telemetry) */}
      {events !== null && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold">Events · last 30 days</h2>
          {events.length === 0 ? (
            <p className="text-sm text-secondary">
              No events logged yet — telemetry starts recording from now.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-raised/50 font-mono text-[11px] tracking-[0.04em] text-secondary uppercase">
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2 text-right">Last 7d</th>
                    <th className="px-3 py-2 text-right">30d total</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.event} className="border-b border-line/60 last:border-b-0">
                      <td className="px-3 py-2 font-mono text-[12px]">{e.event}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.last7d}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
