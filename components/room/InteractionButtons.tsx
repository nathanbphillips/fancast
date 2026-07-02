"use client";

import { useEffect, useState } from "react";

/**
 * Ask Question + Request to Talk (FR-10.1, FR-4.2). Each expands inline
 * below the buttons. The first-ever talk request requires the consent
 * checkbox; copy verbatim from docs/LEGAL_PAGES.md.
 */

const CONSENT_COPY =
  "You're asking to go on air. If the commentator accepts, your voice is " +
  "broadcast live to everyone in the room and becomes part of the show's " +
  "recording, which the commentator owns and may publish (for example, as " +
  "a podcast episode). You can leave the air at any time with the Leave " +
  "Air button.";

const REPEAT_COPY = "Live to the room. Recorded as part of the show.";

export function InteractionButtons({
  roomId,
  consentGiven,
  hasPendingTalk,
  resolvedSignal,
  queuePosition = null,
}: {
  roomId: string;
  consentGiven: boolean;
  hasPendingTalk: boolean;
  /** bumps when this viewer's talk request is dismissed/accepted/completed */
  resolvedSignal: number;
  /** this viewer's 1-based place in the call-in queue, pushed on their own
   *  per-user channel; null until known (Phase 5c) */
  queuePosition?: number | null;
}) {
  const [open, setOpen] = useState<"none" | "question" | "talk">("none");
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [questionSent, setQuestionSent] = useState(false);
  const [talkPending, setTalkPending] = useState(hasPendingTalk);

  // when the server resolves this viewer's request, re-enable the button so
  // they can request again without a reload (M-10, audit)
  useEffect(() => {
    if (resolvedSignal > 0) {
      setTalkPending(false);
      setTopic("");
      setOpen("none");
      setNote(null);
    }
  }, [resolvedSignal]);

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, body: question.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setQuestion("");
      setQuestionSent(true);
      setTimeout(() => {
        setQuestionSent(false);
        setOpen("none");
      }, 2000);
    } else {
      const body = await res.json().catch(() => ({}));
      setNote(body.error ?? "Couldn't send that.");
    }
  }

  async function leaveQueue() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/talk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId }),
    });
    setBusy(false);
    if (res.ok || res.status === 404) {
      // 404 = already resolved elsewhere (accepted/dismissed) — either way,
      // nothing is pending any more
      setTalkPending(false);
    } else {
      const body = await res.json().catch(() => ({}));
      setNote(body.error ?? "Couldn't leave the queue.");
    }
  }

  async function submitTalk(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        topic: topic.trim(),
        consent: consentGiven || consent,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setTopic("");
      setTalkPending(true);
      setOpen("none");
    } else {
      const body = await res.json().catch(() => ({}));
      setNote(body.error ?? "Couldn't send that.");
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setNote(null);
            setOpen(open === "question" ? "none" : "question");
          }}
          aria-expanded={open === "question"}
          className={`h-11 flex-1 rounded-lg border text-sm ${
            open === "question"
              ? "border-gold font-semibold"
              : "border-line bg-surface hover:bg-raised"
          }`}
        >
          Ask Question
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (talkPending) {
              // tap to leave the queue (founder 2026-07-02)
              void leaveQueue();
              return;
            }
            setNote(null);
            setOpen(open === "talk" ? "none" : "talk");
          }}
          aria-expanded={open === "talk"}
          title={talkPending ? "Tap to leave the queue" : undefined}
          className={`h-11 flex-1 rounded-lg border text-sm disabled:opacity-60 ${
            open === "talk"
              ? "border-gold font-semibold"
              : talkPending
                ? "border-red/40 font-semibold text-red hover:bg-red/10"
                : "border-line bg-surface hover:bg-raised"
          }`}
        >
          {talkPending
            ? queuePosition != null
              ? `In line · #${queuePosition} · tap to leave`
              : "Pending · tap to leave"
            : "Request to Talk"}
        </button>
      </div>

      {note && (
        <p role="alert" className="mt-2 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-secondary">
          {note}
        </p>
      )}

      {open === "question" && (
        <form onSubmit={submitQuestion} className="mt-2 space-y-2">
          {questionSent ? (
            <p className="rounded-lg border border-line bg-raised px-3 py-2 text-sm text-green">
              Sent to the commentator.
            </p>
          ) : (
            <>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={280}
                rows={2}
                required
                placeholder="Your question — only the commentator sees it"
                aria-label="Your question"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-secondary"
              />
              <button
                type="submit"
                disabled={busy || !question.trim()}
                className="h-11 w-full rounded-lg bg-red text-sm font-semibold text-white disabled:opacity-60"
              >
                Send question
              </button>
            </>
          )}
        </form>
      )}

      {open === "talk" && (
        <form onSubmit={submitTalk} className="mt-2 space-y-2">
          <p className="text-xs text-secondary">{REPEAT_COPY}</p>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={120}
            required
            placeholder="What do you want to talk about?"
            aria-label="Call-in topic"
            className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
          />
          {!consentGiven && (
            <label className="flex items-start gap-2 rounded-lg border-[0.75px] border-line bg-raised p-3 text-xs leading-relaxed text-secondary">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-(--gold)"
              />
              <span>
                {CONSENT_COPY}
                <span className="mt-1 block font-semibold text-primary">
                  I understand and agree.
                </span>
              </span>
            </label>
          )}
          <button
            type="submit"
            disabled={busy || !topic.trim() || (!consentGiven && !consent)}
            className="h-11 w-full rounded-lg bg-red text-sm font-semibold text-white disabled:opacity-60"
          >
            Send request
          </button>
        </form>
      )}
    </div>
  );
}
