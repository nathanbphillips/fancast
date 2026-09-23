"use client";

/**
 * ASK THE GANTRY - the public question panel for the live room.
 *
 * Public since founder 2026-09-22 (supersedes the private host inbox surface):
 * everyone reads the list, signed-in listeners upvote (votes are weighted
 * upstream), and the host marks a question answered-on-air or dismisses it.
 * Ranking is by weighted score descending, ties newest-first. Answered
 * questions keep their place in the ranking. This component holds no question
 * state itself - list, votes and statuses all arrive via props and optimistic
 * updates happen upstream; only the composer input and its sending flag are
 * local.
 */

import { useMemo, useState } from "react";
import type { Question } from "@/lib/db/types";

type Props = {
  questions: Question[];
  /** viewer's own upvotes by question id */
  myVotes: Record<string, 1>;
  /** optimistic upstream */
  onVote: (questionId: string, value: 1 | 0) => void;
  /** viewer may upvote (signed in etc.) */
  canVote: boolean;
  /** signed-in and room open */
  canAsk: boolean;
  /** shown instead of the composer when canAsk is false; null hides the whole composer area */
  askDisabledNote: string | null;
  /** resolves true on success (clears input) */
  onAsk: (body: string) => Promise<boolean>;
  /** shows Mark answered / Dismiss controls */
  isHost: boolean;
  onSetStatus: (questionId: string, status: "acknowledged" | "dismissed") => void;
  /** maps answered_at to a match-minute label like "44'" or null */
  answeredMinute: (iso: string) => string | null;
};

/** Compact relative time for question bylines (e.g. "12m", "2h", "1d"). */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function AskGantryPanel({
  questions,
  myVotes,
  onVote,
  canVote,
  canAsk,
  askDisabledNote,
  onAsk,
  isHost,
  onSetStatus,
  answeredMinute,
}: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const visible = useMemo(() => {
    return questions
      .filter((q) => q.status !== "dismissed")
      .slice()
      .sort((a, b) => {
        const diff = Number(b.score) - Number(a.score);
        if (diff !== 0) return diff;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
  }, [questions]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const ok = await onAsk(trimmed);
      if (ok) setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <p className="italic text-[15.5px] text-tertiary mt-2.5">
        Question the commentator. Votes push it up the host&apos;s list -
        answered on air.
      </p>

      {visible.length === 0 ? (
        <p className="italic text-[15.5px] text-tertiary mt-4">
          No questions yet. Ask the first one.
        </p>
      ) : (
        <ul>
          {visible.map((q) => {
            const voted = Boolean(myVotes[q.id]);
            const minute =
              q.status === "acknowledged" && q.answered_at
                ? answeredMinute(q.answered_at)
                : null;
            return (
              <li
                key={q.id}
                className="flex gap-4 items-start py-3.5 px-0.5 border-b border-line"
              >
                <button
                  type="button"
                  aria-pressed={voted}
                  disabled={!canVote}
                  onClick={
                    canVote ? () => onVote(q.id, voted ? 0 : 1) : undefined
                  }
                  className={`font-mono text-[15.5px] px-3.5 py-1.5 whitespace-nowrap shrink-0 border-[1.5px] tabular-nums ${
                    voted
                      ? "border-red bg-red-fill text-on-red"
                      : "border-red text-red bg-transparent"
                  } ${canVote ? "cursor-pointer" : "opacity-50 cursor-default"}`}
                >
                  &#9650; {q.up_count}
                </button>
                <div className="min-w-0">
                  <p className="text-[17px] leading-[1.5]">{q.body}</p>
                  <p className="font-mono text-[14px] text-secondary mt-0.5">
                    <span className="fv-normal">
                      {q.author?.username ?? "someone"}
                    </span>{" "}
                    {/* SSR and hydration can land in different minute
                        buckets; same suppression the chat stamps use */}
                    &middot;{" "}
                    <span suppressHydrationWarning>{timeAgo(q.created_at)}</span>
                    {q.status === "acknowledged" ? (
                      <span className="text-red">
                        {" "}
                        &middot; &#10003; answered on air
                        {minute ? ` ${minute}` : ""}
                      </span>
                    ) : null}
                  </p>
                </div>
                {isHost ? (
                  <div className="ml-auto flex flex-col gap-1 shrink-0 items-end">
                    {q.status === "new" ? (
                      <button
                        type="button"
                        onClick={() => onSetStatus(q.id, "acknowledged")}
                        className="font-mono text-[14px] text-red cursor-pointer border-b border-red bg-transparent p-0"
                      >
                        Mark answered
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onSetStatus(q.id, "dismissed")}
                      className="font-mono text-[14px] text-red cursor-pointer border-b border-red bg-transparent p-0"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canAsk ? (
        <form
          onSubmit={handleSubmit}
          className="flex mt-4 border-b-2 border-primary max-w-[640px]"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={280}
            placeholder="Ask the host anything&hellip;"
            className="flex-1 min-w-0 bg-transparent text-[17px] py-2 px-1 outline-none placeholder:italic"
          />
          <button
            type="submit"
            disabled={sending}
            className="bg-red-fill text-on-red font-mono text-[15.5px] tracking-[0.1em] px-5 py-2 whitespace-nowrap cursor-pointer"
          >
            Ask &rarr;
          </button>
        </form>
      ) : askDisabledNote !== null ? (
        <p className="italic text-[15px] text-tertiary mt-4">
          {askDisabledNote}
        </p>
      ) : null}
    </div>
  );
}
