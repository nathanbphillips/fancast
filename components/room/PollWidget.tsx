"use client";

import { useState } from "react";
import type { MyPollVote, PollState } from "@/lib/db/types";
import { useToast } from "@/components/Toast";

/**
 * Half-time poll (FR-12.2). The commentator poses a 2-4 option question; signed-in
 * listeners tap one option and live results render for everyone via the control
 * channel. Read-only once closed. The composer is commentator-only.
 */

export function PollWidget({
  poll,
  myVote,
  canVote,
  isCommentator,
}: {
  poll: NonNullable<PollState>;
  myVote: MyPollVote;
  canVote: boolean;
  isCommentator: boolean;
}) {
  const initialMine = myVote?.pollId === poll.id ? myVote.optionIdx : null;
  const [mine, setMine] = useState<number | null>(initialMine);
  const [busy, setBusy] = useState(false);
  const open = poll.status === "open";
  const total = poll.total;
  const toast = useToast();

  async function vote(idx: number) {
    if (!open || !canVote || busy) return;
    setBusy(true);
    setMine(idx); // optimistic; the control event reconciles everyone's results
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vote", pollId: poll.id, optionIdx: idx }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setMine(initialMine); // roll back the optimistic highlight
      toast("Couldn't record your vote.");
    }
  }

  async function close() {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", pollId: poll.id }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) toast("Couldn't close the poll.");
  }

  return (
    <div className="mt-3 rounded-xl border-[0.75px] border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{poll.question}</p>
        <span className="shrink-0 text-[11px] tabular-nums text-secondary">
          {open ? "live" : "closed"} · {total}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {poll.options.map((opt, i) => {
          const count = poll.results[i] ?? 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const isMine = mine === i;
          const tappable = open && canVote;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!tappable || busy}
                onClick={() => vote(i)}
                aria-pressed={isMine}
                className={`relative block w-full overflow-hidden rounded-lg border px-3 py-1.5 text-left text-xs ${
                  isMine ? "border-gold" : "border-line"
                } ${tappable ? "hover:bg-raised" : "cursor-default"}`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-raised"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex justify-between">
                  <span className={`truncate ${isMine ? "font-semibold text-gold" : ""}`}>{opt}</span>
                  <span className="ml-2 shrink-0 tabular-nums text-secondary">{pct}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && isCommentator && (
        <button
          type="button"
          onClick={close}
          disabled={busy}
          className="mt-2 w-full rounded-lg border border-line py-1.5 text-xs font-semibold text-secondary hover:bg-raised disabled:opacity-60"
        >
          Close poll
        </button>
      )}
      {open && !canVote && !isCommentator && (
        <p className="mt-1 text-[11px] text-secondary">Sign in to vote.</p>
      )}
    </div>
  );
}

export function PollComposer({ roomId }: { roomId: string }) {
  const [openForm, setOpenForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        roomId,
        question: question.trim(),
        options: options.map((o) => o.trim()).filter(Boolean),
      }),
    });
    setBusy(false);
    if (res.ok) {
      setQuestion("");
      setOptions(["", ""]);
      setOpenForm(false);
    } else {
      const b = await res.json().catch(() => ({}));
      setErr(b.error ?? "Couldn't create the poll.");
    }
  }

  if (!openForm) {
    return (
      <button
        type="button"
        onClick={() => setOpenForm(true)}
        className="mt-3 w-full rounded-lg border border-line py-1.5 text-xs font-semibold text-secondary hover:bg-raised"
      >
        + New poll
      </button>
    );
  }

  return (
    <form onSubmit={create} className="mt-3 space-y-2 rounded-xl border-[0.75px] border-line bg-surface p-3">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={140}
        placeholder="Poll question"
        aria-label="Poll question"
        className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
      />
      {options.map((opt, i) => (
        <input
          key={i}
          type="text"
          value={opt}
          onChange={(e) => setOptions((o) => o.map((x, j) => (j === i ? e.target.value : x)))}
          maxLength={60}
          placeholder={`Option ${i + 1}`}
          aria-label={`Option ${i + 1}`}
          className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
        />
      ))}
      {options.length < 4 && (
        <button
          type="button"
          onClick={() => setOptions((o) => [...o, ""])}
          className="text-xs font-semibold text-secondary hover:text-primary"
        >
          + add option
        </button>
      )}
      {err && (
        <p role="alert" className="text-xs text-red">
          {err}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!valid || busy}
          className="h-9 flex-1 rounded-lg bg-red text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "…" : "Start poll"}
        </button>
        <button
          type="button"
          onClick={() => setOpenForm(false)}
          className="h-9 rounded-lg border border-line px-3 text-sm text-secondary hover:bg-raised"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
