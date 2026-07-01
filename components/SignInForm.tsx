"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/db/client";
import { Button } from "@/components/ui/Button";

/**
 * Sign-in (Cloud Design): email magic-link (primary) + Google OAuth. Google
 * works once the Supabase provider is enabled — until then it surfaces the
 * provider error rather than faking success.
 */
export function SignInForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else {
      setState("sent");
    }
  }

  async function signInWithGoogle() {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h2 className="font-display text-lg">Check your email</h2>
        <p className="mt-2 text-sm text-secondary">
          We sent a sign-in link to{" "}
          <span className="font-semibold text-primary">{email}</span>. Open it on
          this device and you&apos;re in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red/40 bg-surface px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}

      <form onSubmit={sendMagicLink} className="space-y-3">
        <label
          htmlFor="email"
          className="block font-mono text-[11px] font-bold tracking-wider text-secondary uppercase"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-12 w-full rounded-xl border border-line bg-inset px-4 text-sm placeholder:text-secondary focus:border-red focus:outline-none"
        />
        <Button
          type="submit"
          variant="red"
          disabled={state === "sending"}
          className="w-full"
        >
          {state === "sending" ? "Sending…" : "Continue with email →"}
        </Button>
      </form>

      <div className="flex items-center gap-3 font-mono text-[11px] tracking-wider text-secondary uppercase">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-inset text-sm font-semibold hover:bg-raised"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            fill="#4285F4"
            d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.29 14.29A7.22 7.22 0 0 1 4.91 12c0-.8.14-1.57.38-2.29v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z"
          />
        </svg>
        Continue with Google
      </button>

      <p className="text-center text-xs text-secondary">
        No password needed — the email link signs you in.
      </p>
    </div>
  );
}
