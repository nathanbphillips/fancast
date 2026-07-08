"use client";

import { useCallback, useEffect, useState } from "react";
import { brand } from "@/lib/brand";

/**
 * Commentator downloads panel (FR-13.5/13.6), shown when the room is
 * wrapped. Processing status while cutting, then the full broadcast +
 * per-segment MP3s with names/durations/sizes, a zip, ±2min marker
 * adjustment with recut, and the rights notice + copyable courtesy line.
 */

type RecFile = {
  label: string;
  filename: string;
  url: string | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
};
type RecMarker = {
  id: string;
  label: string;
  server_ts: string;
  adjusted_ts: string | null;
};
type RecData = {
  recording: { status: string; durationSeconds: number | null; error: string | null } | null;
  files: RecFile[];
  zipUrl: string | null;
  markers: RecMarker[];
  courtesyLine: string;
};

function fmtDuration(s: number | null): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function fmtSize(b: number | null): string {
  if (b == null) return "—";
  return b > 1024 * 1024
    ? `${(b / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function DownloadsPanel({ roomId }: { roomId: string }) {
  const [data, setData] = useState<RecData | null>(null);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [recutting, setRecutting] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/recordings?room=${roomId}`);
    if (res.ok) setData(await res.json());
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  // poll while processing (server status, or a local recut in flight)
  const status = data?.recording?.status;
  const polling = status === "processing" || recutting;
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [polling, load]);

  if (!data) {
    return (
      <div className="p-6 text-center text-sm text-secondary">Loading…</div>
    );
  }

  if (!data.recording) {
    return (
      <div className="p-6 text-center text-sm text-secondary">
        No recording for this session.
      </div>
    );
  }

  async function triggerProcess() {
    await fetch("/api/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "process", roomId }),
    });
  }

  async function recut() {
    setRecutting(true);
    // apply each pending nudge, then one async recut
    for (const [markerId, delta] of Object.entries(pending)) {
      await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust", roomId, markerId, deltaSeconds: delta }),
      });
    }
    setPending({});
    await triggerProcess();
    // wait out the async run: processing flips to processing, then ready
    const started = Date.now();
    let sawProcessing = false;
    while (Date.now() - started < 5 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 2500));
      const res = await fetch(`/api/recordings?room=${roomId}`);
      if (!res.ok) continue;
      const fresh: RecData = await res.json();
      setData(fresh);
      const s = fresh.recording?.status;
      if (s === "processing") sawProcessing = true;
      else if (s === "ready" && (sawProcessing || Date.now() - started > 6000)) break;
      else if (s === "failed") break;
    }
    setRecutting(false);
  }

  function nudge(markerId: string, server_ts: string, adjusted_ts: string | null, step: number) {
    const base =
      pending[markerId] ??
      (adjusted_ts
        ? Math.round((new Date(adjusted_ts).getTime() - new Date(server_ts).getTime()) / 1000)
        : 0);
    const next = Math.max(-120, Math.min(120, base + step));
    setPending((p) => ({ ...p, [markerId]: next }));
  }

  const rec = data.recording;

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      <div>
        <h2 className="text-lg font-bold">Your recording</h2>
        <p className="mt-0.5 text-sm text-secondary">
          {rec.status === "processing" && "Cutting your segments — this can take a few minutes."}
          {rec.status === "ready" &&
            `Full broadcast plus ${data.files.length - 1} segments · ${fmtDuration(rec.durationSeconds)} total`}
          {rec.status === "failed" && `Processing failed: ${rec.error ?? "unknown error"}`}
          {rec.status === "empty" && "No audio was captured for this session."}
          {rec.status === "recording" && "Still recording…"}
        </p>
      </div>

      {rec.status === "processing" && (
        <div className="flex items-center gap-3 rounded-xl border-[0.75px] border-line bg-raised p-4">
          <span className="h-3 w-3 animate-live-pulse rounded-full bg-red" aria-hidden="true" />
          <span className="flex-1 text-sm">Processing…</span>
          {/* a crashed/timed-out run is reclaimable after a stale window;
              this lets the commentator nudge it without a DB edit */}
          <button
            type="button"
            onClick={triggerProcess}
            className="h-9 shrink-0 rounded-md border border-line px-3 text-xs font-semibold text-secondary hover:text-primary"
          >
            Retry if stuck
          </button>
        </div>
      )}

      {rec.status === "ready" && (
        <>
          {data.zipUrl && (
            <a
              href={data.zipUrl}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-red text-sm font-semibold text-white"
            >
              Download everything (zip)
            </a>
          )}

          <ul className="space-y-2">
            {data.files.map((f, i) => (
              <li
                key={f.filename}
                className={`flex items-center gap-3 rounded-xl border-[0.75px] border-line bg-surface p-3 ${
                  i === 0 ? "border-l-4 border-l-red" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.label}</p>
                  <p className="text-xs text-secondary tabular-nums">
                    {fmtDuration(f.durationSeconds)} · {fmtSize(f.sizeBytes)}
                  </p>
                </div>
                {f.url && (
                  <a
                    href={f.url}
                    className="h-9 shrink-0 rounded-md border border-line px-3 text-xs font-semibold leading-9 hover:bg-raised"
                  >
                    Download
                  </a>
                )}
              </li>
            ))}
          </ul>

          {data.markers.length > 0 && (
            <section className="rounded-xl border-[0.75px] border-line bg-surface p-4">
              <h3 className="text-sm font-bold">Adjust segment boundaries</h3>
              <p className="mt-0.5 text-xs text-secondary">
                Nudge any boundary up to ±2 minutes, then recut.
              </p>
              <ul className="mt-3 space-y-2">
                {data.markers.map((m) => {
                  const delta =
                    pending[m.id] ??
                    (m.adjusted_ts
                      ? Math.round(
                          (new Date(m.adjusted_ts).getTime() - new Date(m.server_ts).getTime()) / 1000,
                        )
                      : 0);
                  return (
                    <li key={m.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{m.label}</span>
                      <button
                        type="button"
                        onClick={() => nudge(m.id, m.server_ts, m.adjusted_ts, -15)}
                        aria-label={`Move ${m.label} 15 seconds earlier`}
                        className="h-9 w-12 rounded-md border border-line text-xs font-bold tabular-nums hover:bg-raised"
                      >
                        −15s
                      </button>
                      <span className="w-14 text-center text-xs font-semibold tabular-nums">
                        {delta > 0 ? "+" : ""}
                        {delta}s
                      </span>
                      <button
                        type="button"
                        onClick={() => nudge(m.id, m.server_ts, m.adjusted_ts, 15)}
                        aria-label={`Move ${m.label} 15 seconds later`}
                        className="h-9 w-12 rounded-md border border-line text-xs font-bold tabular-nums hover:bg-raised"
                      >
                        +15s
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                disabled={recutting || Object.keys(pending).length === 0}
                onClick={recut}
                className="mt-3 h-11 w-full rounded-lg border border-line text-sm font-semibold text-red hover:bg-raised disabled:opacity-50"
              >
                {recutting ? "Recutting…" : "Apply changes & recut"}
              </button>
            </section>
          )}
        </>
      )}

      {(rec.status === "failed") && (
        <button
          type="button"
          onClick={recut}
          disabled={recutting}
          className="h-11 w-full rounded-lg border border-line text-sm font-semibold hover:bg-raised disabled:opacity-50"
        >
          {recutting ? "Retrying…" : "Retry processing"}
        </button>
      )}

      {/* rights notice + courtesy line (FR-13.6; copy from LEGAL_PAGES.md) */}
      <section className="rounded-xl border-[0.75px] border-line bg-raised p-4 text-sm">
        <p className="font-semibold">These recordings are yours.</p>
        <p className="mt-1 text-secondary">
          {brand.name} claims no rights and requires nothing. If you&apos;d like
          to credit the show, you can copy:
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1.5 text-xs">
            {data.courtesyLine}
          </code>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(data.courtesyLine);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
            className="h-9 shrink-0 rounded-md border border-line px-3 text-xs font-semibold hover:bg-raised"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>
    </div>
  );
}
