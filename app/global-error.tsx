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
          fontFamily: "Georgia, 'Times New Roman', serif",
          padding: "4rem 1rem",
          textAlign: "center",
          background: "#F7F1E2",
          color: "#1B1A15",
          minHeight: "100vh",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ marginTop: "0.5rem", opacity: 0.7 }}>Please try again in a moment.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.25rem",
            padding: "0.65rem 1.25rem",
            background: "#1B1A15",
            color: "#F7F1E2",
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
