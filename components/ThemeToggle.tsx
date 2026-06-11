"use client";

import { useEffect, useState } from "react";

/**
 * Header theme toggle. Default is system preference (set pre-paint in
 * app/layout.tsx); a tap stores an explicit choice in localStorage.
 * Phase 2 adds profiles.theme_pref for signed-in users.
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
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-raised hover:text-primary"
    >
      {/* render both icons, hide one with CSS-free state to avoid hydration flicker */}
      <span aria-hidden="true" className="text-lg leading-none">
        {isDark === null ? "◐" : isDark ? "☀" : "☾"}
      </span>
    </button>
  );
}
