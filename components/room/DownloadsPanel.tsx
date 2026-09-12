"use client";

import { useCallback, useEffect, useState } from "react";
import { brand } from "@/lib/brand";
import { buildZipStore } from "@/lib/zipStore";

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
  recording: {
    status: string;
    durationSeconds: number | null;
    audioSeconds: number | null;
    error: string | null;
  } | null;
  files: RecFile[];
  zipUrl: string | null;
  markers: RecMarker[];
  /** recording pauses (founder 2026-08-22): stretches the host cut out live */
  pauses?: { count: number; excludedSeconds: number };
  /** a stale run was just re-kicked server-side (2026-09-01) */
  stalled?: boolean;
  attempts?: number;
  /** why there is no Full broadcast file, when that is by design */
  fullNote?: string | null;
  /** how long files live, or that they already aged out (founder 2026-09-14) */
  retentionNote?: string | null;
  /** podcast-style notes for the pre/post-game shows (match rooms only) */
  episodeNotes?: {
    pregame: { title: string; description: string; txtName: string };
    match?: { title: string; description: string; txtName: string };
    postgame: { title: string; description: string; txtName: string };
  } | null;
  courtesyLine: string;
};

/** copy-to-clipboard with a brief confirmation flash */
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="h-8 shrink-0 rounded-md border border-line px-2 text-[11px] font-semibold text-secondary hover:text-primary"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** episode notes block: title + description, copyable, downloadable as .txt */
function NotesBlock({
  heading,
  note,
}: {
  heading: string;
  note: { title: string; description: string; txtName: string };
}) {
  const txt = `${note.title}\n\n${note.description}\n`;
  return (
    <div className="rounded-lg border-[0.75px] border-line bg-raised p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-[0.08em] text-secondary uppercase">{heading}</p>
        <button
          type="button"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = note.txtName;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }}
          className="h-8 shrink-0 rounded-md border border-line px-2 text-[11px] font-semibold text-secondary hover:text-primary"
        >
          Download .txt
        </button>
      </div>
      <div className="mt-2 flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">{note.title}</p>
        <CopyBtn text={note.title} label={`Copy the ${heading} title`} />
      </div>
      <div className="mt-1.5 flex items-start gap-2">
        <p className="min-w-0 flex-1 text-xs text-secondary">{note.description}</p>
        <CopyBtn text={note.description} label={`Copy the ${heading} description`} />
      </div>
    </div>
  );
}

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
  const [backingUp, setBackingUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/recordings?room=${roomId}`);
    if (res.ok) setData(await res.json());
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while the recording is still settling. "recording" MUST be included:
  // after End Broadcast the row sits at 'recording' until processing claims it,
  // and without polling that state the host stared at "Still recording…"
  // forever unless they reloaded (founder 2026-08-05).
  const status = data?.recording?.status;
  const polling = status === "processing" || status === "recording" || recutting;
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

  /** One-click local backup (founder 2026-09-07): pre-game + Full match +
   *  post-game fetched in the browser and zipped client-side (store-only, so
   *  no server round-trip and no function size limits; MP3 does not compress). */
  async function downloadBackup() {
    setBackingUp(true);
    setBackupError(null);
    try {
      // signed URLs live 60 minutes; a tab left open longer holds dead links,
      // so mint a fresh set at click time instead of trusting state
      const freshRes = await fetch(`/api/recordings?room=${roomId}`);
      if (!freshRes.ok) throw new Error(String(freshRes.status));
      const fresh = (await freshRes.json()) as RecData;
      const wanted = ["Pre-game show", "Full match", "Post-game show"];
      const files = wanted.map((l) => fresh.files.find((f) => f.label === l && f.url));
      if (files.some((f) => !f)) throw new Error("missing file");
      const entries: { name: string; data: Uint8Array }[] = [];
      for (const f of files) {
        const res = await fetch(f!.url!);
        if (!res.ok) throw new Error(String(res.status));
        entries.push({ name: f!.filename, data: new Uint8Array(await res.arrayBuffer()) });
      }
      const zip = buildZipStore(entries);
      const blob = new Blob([zip as BlobPart], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = files[0]!.filename.replace(/ - \d\d .*\.mp3$/, "") + " - backup.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch {
      setBackupError("Backup download failed. Try again.");
    } finally {
      setBackingUp(false);
    }
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
      else if (s === "failed" || s === "damaged") break;
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
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Your recording</h2>
          {/* these files outlive the room — point the host at the library */}
          <a
            href="/host/recordings"
            className="shrink-0 text-xs font-semibold text-secondary hover:text-primary"
          >
            All recordings →
          </a>
        </div>
        <p className="mt-0.5 text-sm text-secondary">
          {rec.status === "processing" &&
            ((data.attempts ?? 0) > 1 || data.stalled
              ? `A long show can take several passes. It retries by itself while this page is open (attempt ${Math.max(1, data.attempts ?? 1)}).`
              : "Cutting your segments — this can take a few minutes.")}
          {rec.status === "ready" &&
            (data.files.length === 0
              ? `Processed · ${fmtDuration(rec.durationSeconds)} total`
              : data.files[0]?.label === "Full broadcast"
                ? `Full broadcast plus ${data.files.length - 1} segments · ${fmtDuration(rec.durationSeconds)} total`
                : `${data.files.length} part ${data.files.length === 1 ? "file" : "files"} · ${fmtDuration(rec.durationSeconds)} total`)}
          {rec.status === "damaged" &&
            (data.files.length === 0
              ? `Processed · ${fmtDuration(rec.audioSeconds ?? rec.durationSeconds)} captured`
              : data.files[0]?.label === "Full broadcast"
                ? `Full broadcast plus ${data.files.length - 1} segments · ${fmtDuration(rec.audioSeconds ?? rec.durationSeconds)} captured`
                : `${data.files.length} part ${data.files.length === 1 ? "file" : "files"} · ${fmtDuration(rec.audioSeconds ?? rec.durationSeconds)} captured`)}
          {rec.status === "failed" && `Processing failed: ${rec.error ?? "unknown error"}`}
          {rec.status === "empty" && "No audio was captured for this session."}
          {rec.status === "recording" &&
            "Finishing up — your files appear here automatically."}
        </p>
        {data.fullNote && (rec.status === "ready" || rec.status === "damaged") && (
          <p className="mt-0.5 text-xs text-secondary">{data.fullNote}</p>
        )}
        {data.retentionNote && (
          <p className="mt-0.5 text-xs text-secondary">{data.retentionNote}</p>
        )}
        {data.pauses && data.pauses.count > 0 && (
          <p className="mt-0.5 text-xs text-secondary tabular-nums">
            {data.pauses.count === 1
              ? "1 recording pause"
              : `${data.pauses.count} recording pauses`}{" "}
            · {fmtDuration(data.pauses.excludedSeconds)} left out of the files.
          </p>
        )}
      </div>

      {/* A damaged recording downloads perfectly well, which is exactly the
          problem: without this the host finds out by pressing play. */}
      {rec.status === "damaged" && (
        <div className="rounded-xl border border-red/50 bg-red/10 p-4">
          <p className="text-sm font-bold text-red">
            This recording does not match your broadcast
          </p>
          <p className="mt-1 text-sm text-primary">
            {rec.error ?? "The captured audio is incomplete."}
          </p>
          {rec.durationSeconds != null && rec.audioSeconds != null && (
            <p className="mt-1 text-xs text-secondary tabular-nums">
              {fmtDuration(rec.audioSeconds)} of audio captured for a{" "}
              {fmtDuration(rec.durationSeconds)} broadcast.
            </p>
          )}
          <p className="mt-2 text-xs text-secondary">
            The files below are real, they just are not the whole show. Keep
            them, and report this so we can find out what dropped.
          </p>
        </div>
      )}

      {rec.status === "recording" && (
        <div className="flex items-center gap-3 rounded-xl border-[0.75px] border-line bg-raised p-4">
          <span className="h-3 w-3 animate-live-pulse rounded-full bg-red-fill" aria-hidden="true" />
          <span className="flex-1 text-sm">
            Wrapping up the session…
          </span>
          {/* the trigger runs after End Broadcast, but if that never landed
              this starts it by hand rather than leaving the host stuck */}
          <button
            type="button"
            onClick={triggerProcess}
            className="h-9 shrink-0 rounded-md border border-line px-3 text-xs font-semibold text-secondary hover:text-primary"
          >
            Process now
          </button>
        </div>
      )}

      {rec.status === "processing" && (
        <div className="flex items-center gap-3 rounded-xl border-[0.75px] border-line bg-raised p-4">
          <span className="h-3 w-3 animate-live-pulse rounded-full bg-red-fill" aria-hidden="true" />
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

      {(rec.status === "ready" || rec.status === "damaged") && (
        <>
          {data.zipUrl && (
            <a
              href={data.zipUrl}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-red-fill text-sm font-semibold text-white"
            >
              Download everything (zip)
            </a>
          )}

          {["Pre-game show", "Full match", "Post-game show"].every((l) =>
            data.files.some((f) => f.label === l && f.url),
          ) && (
            <div>
              <button
                type="button"
                disabled={backingUp}
                onClick={() => void downloadBackup()}
                className="flex h-11 w-full items-center justify-center rounded-lg border border-line text-sm font-semibold hover:bg-raised disabled:opacity-60"
              >
                {backingUp
                  ? "Preparing backup… this takes a minute"
                  : "Download backup (pre-game + full match + post-game)"}
              </button>
              {backupError && <p className="mt-1 text-xs text-red">{backupError}</p>}
            </div>
          )}

          <ul className="space-y-2">
            {data.files.map((f, i) => (
              <li
                key={f.filename}
                className={`flex items-center gap-3 rounded-xl border-[0.75px] border-line bg-surface p-3 ${
                  i === 0 && f.label === "Full broadcast" ? "border-l-4 border-l-red" : ""
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

          {data.episodeNotes && (
            <section className="rounded-xl border-[0.75px] border-line bg-surface p-4">
              <h3 className="text-sm font-bold">Episode notes</h3>
              <p className="mt-0.5 text-xs text-secondary">
                Ready-made title and description for each show. Copy them, or
                download as .txt.
              </p>
              <div className="mt-3 space-y-2">
                <NotesBlock heading="Pre-game show" note={data.episodeNotes.pregame} />
                {data.episodeNotes.match && (
                  <NotesBlock heading="Full match" note={data.episodeNotes.match} />
                )}
                <NotesBlock heading="Post-game show" note={data.episodeNotes.postgame} />
              </div>
            </section>
          )}

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
