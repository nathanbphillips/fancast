"use client";

import { useEffect } from "react";

/**
 * Applies a signed-in user's saved theme preference (profiles.theme_pref) on
 * devices with no explicit local choice yet. The pre-paint script already does
 * this from the fc_theme cookie before first paint; this is the SPA-navigation
 * / stale-cookie guard. It must NOT persist the account default into the
 * localStorage "theme" key — that key is reserved for an explicit device tap,
 * and writing it would make a passive default a sticky override (L-3, audit).
 */
export function ThemeSync({ themePref }: { themePref: "dark" | "light" | null }) {
  useEffect(() => {
    if (!themePref) return;
    try {
      if (localStorage.getItem("theme")) return; // explicit device choice wins
      document.documentElement.classList.toggle("dark", themePref === "dark");
    } catch {
      // storage unavailable — system preference continues to apply
    }
  }, [themePref]);

  return null;
}
