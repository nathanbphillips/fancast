import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { loadHostRecordings } from "@/lib/db/recordings";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Your recordings",
  robots: { index: false, follow: false },
};

/**
 * A host's full recording library (founder 2026-08-05): every show they've
 * hosted, newest first, with one-click downloads for anything that's ready and
 * an honest status for anything that isn't. Per-show detail (segments, marker
 * adjustment, recut) lives at /host/recordings/[roomId].
 */

function fmtDuration(s: number | null): string {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function statusChip(status: string) {
  const map: Record<string, string> = {
    ready: "border-green/50 text-green",
    processing: "border-red/50 text-red",
    recording: "border-red/50 text-red",
    failed: "border-red/50 text-red",
    empty: "border-line text-secondary",
  };
  const label: Record<string, string> = {
    ready: "Ready",
    processing: "Processing",
    recording: "Finishing up",
    failed: "Failed",
    empty: "No audio",
  };
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.06em] uppercase ${
        map[status] ?? "border-line text-secondary"
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}

export default async function HostRecordingsPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user || !profile) redirect("/signin?next=/host/recordings");

  const recordings = await loadHostRecordings(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/host"
        className="text-sm text-secondary transition-colors hover:text-primary"
      >
        ← Host
      </Link>
      <h1 className="t-h2 mt-2">Your recordings</h1>
      <p className="mt-1.5 text-[15px] text-secondary">
        Every show you&apos;ve hosted. {brand.name} claims no rights to any of
        it — download whatever you like, whenever you like.
      </p>

      {recordings.length === 0 ? (
        <p className="mt-8 rounded-xl border border-line bg-surface p-6 text-center text-sm text-secondary">
          No recordings yet. They appear here automatically once you finish a
          broadcast.
        </p>
      ) : (
        <ul className="mt-7 space-y-3">
          {recordings.map((r) => (
            <li
              key={r.roomId}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-mono text-[11px] text-secondary tabular-nums">
                  {r.startedAt.slice(0, 10)}
                </span>
                {statusChip(r.status)}
              </div>
              <p className="mt-1.5 text-[17px] font-bold">{r.title}</p>
              <p className="mt-0.5 text-xs text-secondary tabular-nums">
                {r.status === "ready"
                  ? `${fmtDuration(r.durationSeconds)} · ${r.segmentCount} segment${
                      r.segmentCount === 1 ? "" : "s"
                    }`
                  : r.status === "failed"
                    ? (r.error ?? "Processing failed")
                    : r.status === "empty"
                      ? "No audio was captured"
                      : "Still being prepared"}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.zipUrl && (
                  <a
                    href={r.zipUrl}
                    className="h-10 rounded-lg bg-red px-4 text-sm font-bold leading-10 text-white"
                  >
                    Download all (zip)
                  </a>
                )}
                {r.fullUrl && (
                  <a
                    href={r.fullUrl}
                    className="h-10 rounded-lg border border-line px-4 text-sm font-semibold leading-10 hover:bg-raised"
                  >
                    Full show (MP3)
                  </a>
                )}
                <Link
                  href={`/host/recordings/${r.roomId}`}
                  className="h-10 rounded-lg border border-line px-4 text-sm font-semibold leading-10 hover:bg-raised"
                >
                  {r.status === "ready" ? "Segments & edit" : "Open"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
