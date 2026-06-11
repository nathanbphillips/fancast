"use client";

import { useEffect } from "react";

/**
 * Applies a signed-in user's saved theme preference (profiles.theme_pref)
 * on devices that don't have an explicit local choice yet. An explicit
 * local choice (localStorage) always wins on that device.
 */
export function ThemeSync({ themePref }: { themePref: "dark" | "light" | null }) {
  useEffect(() => {
    if (!themePref) return;
    try {
      if (localStorage.getItem("theme")) return;
      localStorage.setItem("theme", themePref);
      document.documentElement.classList.toggle("dark", themePref === "dark");
    } catch {
      // storage unavailable — system preference continues to apply
    }
  }, [themePref]);

  return null;
}
