"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/db/client";
import { Button } from "@/components/ui/Button";

/**
 * Sign-in (Cloud Design): email magic-link (primary) + Google OAuth. Google
 * works once the Supabase provider is enabled — until then it surfaces the
 * provider error rather than faking success.
 */
export function SignInForm({
  initialError,
  next,
}: {
  initialError?: string;
  /** post-signin destination, already sanitized server-side (RSVP intent etc.) */
  next?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(initialError ?? null);

  // Carry the sanitized `next` through to the auth callback, which re-validates
  // it, so intent (e.g. the room a signed-out user tried to RSVP) survives.
  const callbackUrl = () => {
    const base = `${window.location.origin}/auth/callback`;
    return next && next !== "/"
      ? `${base}?next=${encodeURIComponent(next)}`
      : base;
  };

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
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
      options: { redirectTo: callbackUrl() },
    });
    // If the Google provider isn't enabled (or the redirect fails), fall back to
    // a friendly nudge toward the always-available email link rather than dumping
    // a raw provider error on the user.
    if (error) {
      setError("Couldn't start Google sign-in. Use your email link instead.");
    }
  }

  if (state === "sent") {
    return (
      <div className="border border-primary bg-canvas p-6 text-center">
        <h2 className="display text-lg">Posted ✓</h2>
        <p className="mt-2 text-sm text-secondary">
          Your link is on its way to{" "}
          <span className="font-semibold text-primary">{email}</span>. Open it on
          this device and you&apos;re in.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-3 font-mono text-[12px] tracking-[0.06em] text-red hover:underline"
        >
          Wrong address? Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="border-2 border-red bg-canvas px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}

      <form onSubmit={sendMagicLink} className="space-y-3">
        <label htmlFor="email" className="display block text-[18px]">
          Post us your email
        </label>
        <p className="text-[12.5px] text-secondary italic">
          We return a magic link by first-class post (well - instantly). No
          passwords on this service.
        </p>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-12 w-full border border-primary bg-canvas px-4 text-sm placeholder:text-secondary focus:border-red focus:outline-none"
        />
        <Button
          type="submit"
          variant="red"
          disabled={state === "sending"}
          className="w-full"
        >
          {state === "sending" ? "Sending…" : "Send the magic link →"}
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
        className="flex h-12 w-full items-center justify-center gap-2 border-2 border-primary bg-canvas text-sm font-semibold hover:bg-raised"
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

      <p className="text-center text-xs text-secondary italic">
        Under a minute, start to finish.
      </p>
    </div>
  );
}
