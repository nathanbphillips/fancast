"use client";

import { useState } from "react";

/**
 * Report a profile (FR-18.6): reason picklist + optional note, lands in the
 * admin moderation surface. Shown to signed-in viewers on profiles that
 * aren't their own.
 */
const REASONS = [
  { value: "impersonation", label: "Impersonation" },
  { value: "abuse", label: "Abuse or harassment" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
] as const;

export function ReportProfile({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, reason, note: note.trim() || undefined }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error ?? "Couldn't send the report.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-xs text-secondary">
        Report sent. Thanks; a moderator will take a look.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-secondary underline-offset-2 hover:text-primary hover:underline"
      >
        Report profile
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm space-y-2 rounded-xl border-[0.75px] border-line bg-surface p-3"
    >
      <p className="text-sm font-bold">Report this profile</p>
      {error && (
        <p role="alert" className="rounded-lg border border-red/40 bg-inset px-3 py-1.5 text-xs text-red">
          {error}
        </p>
      )}
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        aria-label="Reason"
        className="h-10 w-full rounded-lg border border-line bg-inset px-2.5 text-sm"
      >
        <option value="" disabled>
          Pick a reason
        </option>
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Anything a moderator should know (optional)"
        aria-label="Report note"
        className="w-full rounded-lg border border-line bg-inset px-2.5 py-2 text-sm placeholder:text-secondary"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !reason}
          className="rounded-lg bg-red px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 py-2 text-sm text-secondary hover:text-primary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
