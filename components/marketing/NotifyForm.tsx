"use client";

import { useState } from "react";

/**
 * Pre-launch email capture (front-end review item 7). Posts to /api/waitlist so
 * the between-matches / no-room-yet states have a real action instead of a dead
 * end, and the founder gets a launch list. Compliance-safe: promises an email
 * when rooms open, never implies we show the match.
 */
export function NotifyForm({
  source = "home",
  className = "",
}: {
  source?: string;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setError(json.error ?? "Couldn't sign you up. Try again.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setError("Couldn't sign you up. Try again.");
    }
  }

  if (state === "done") {
    return (
      <p className={`text-sm font-semibold text-green ${className}`}>
        You&apos;re on the list. We&apos;ll email you when the first rooms open.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Email address"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-inset px-3.5 text-sm placeholder:text-secondary focus:border-red focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="h-11 shrink-0 rounded-lg bg-red px-5 text-sm font-bold text-white transition-colors hover:bg-red-hover disabled:opacity-60"
        >
          {state === "busy" ? "…" : "Notify me"}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-secondary">
          One email when rooms open. No spam, unsubscribe any time.
        </p>
      )}
    </form>
  );
}
