"use client";

import { brand } from "@/lib/brand";

/**
 * Error boundary for the (app) tree (Phase 10 hardening). A thrown SSR read
 * (Supabase unreachable, missing env, etc.) now degrades to a styled, recoverable
 * card with a retry instead of Next's bare default error page.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-secondary">
        {brand.name} hit a snag loading this page — it&apos;s usually temporary.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 h-11 rounded-lg bg-red px-5 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
