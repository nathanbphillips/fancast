"use client";

/**
 * Last-resort boundary for throws in the root layout itself (Phase 10
 * hardening). It replaces the root layout, so it must render its own
 * <html>/<body> and can't rely on Tailwind/theme tokens — inline styles only.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "4rem 1rem",
          textAlign: "center",
          background: "#0f0f11",
          color: "#f4f4f2",
          minHeight: "100vh",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ marginTop: "0.5rem", color: "#9aa0a6" }}>Please try again in a moment.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.25rem",
            padding: "0.65rem 1.25rem",
            borderRadius: 8,
            background: "#f1232b",
            color: "#fff",
            border: 0,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
