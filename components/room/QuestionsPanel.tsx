"use client";

import type { Question } from "@/lib/db/types";

/** Commentator's questions tab (FR-10.1): newest first, ack/dismiss. */
export function QuestionsPanel({
  questions,
  onStatusChange,
}: {
  questions: Question[];
  onStatusChange: (id: string, status: "acknowledged" | "dismissed") => void;
}) {
  async function update(id: string, status: "acknowledged" | "dismissed") {
    onStatusChange(id, status); // optimistic
    await fetch("/api/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: id, status }),
    });
  }

  const visible = questions
    .filter((q) => q.status !== "dismissed")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <ul className="space-y-2 p-3">
      {visible.map((q) => (
        <li
          key={q.id}
          className={`rounded-xl border-[0.75px] border-line bg-surface p-3 ${
            q.status === "acknowledged" ? "opacity-60" : "border-l-4 border-l-red"
          }`}
        >
          <p className="text-xs font-semibold text-secondary">
            {q.author?.username}
          </p>
          <p className="mt-1 text-sm leading-snug">{q.body}</p>
          <div className="mt-2 flex gap-2">
            {q.status === "new" ? (
              <button
                type="button"
                onClick={() => update(q.id, "acknowledged")}
                className="h-9 rounded-md bg-green px-3 text-xs font-bold text-white"
              >
                Acknowledge
              </button>
            ) : (
              <span className="flex h-9 items-center text-xs font-semibold text-green">
                ✓ Acknowledged
              </span>
            )}
            <button
              type="button"
              onClick={() => update(q.id, "dismissed")}
              className="h-9 rounded-md border border-line px-3 text-xs font-semibold text-secondary hover:text-primary"
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
      {visible.length === 0 && (
        <li className="px-3 py-6 text-center text-sm text-secondary">
          No questions yet.
        </li>
      )}
    </ul>
  );
}
