"use client";

import { useEffect, useState } from "react";

/**
 * Header theme toggle (Cloud Design): a pill track with a sliding gold knob.
 * Dark is the default (set pre-paint in app/layout.tsx); a tap stores an
 * explicit choice in localStorage and persists to the account when signed in.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // private mode etc. — theme still switches for this page view
    }
    setIsDark(next);
    // persist to the account when signed in; a 401 (anonymous) is expected
    void fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme_pref: next ? "dark" : "light" }),
    }).catch(() => {});
  }

  const light = isDark === false; // null (pre-mount) shows the dark position
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark ?? false}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-line bg-raised transition-colors"
    >
      <span
        aria-hidden="true"
        className="absolute h-4 w-4 rounded-full bg-red transition-transform duration-200"
        style={{ transform: light ? "translateX(23px)" : "translateX(3px)" }}
      />
    </button>
  );
}
