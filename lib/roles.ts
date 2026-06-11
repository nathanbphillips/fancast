import type { Profile } from "./db/types";

/** User ids granted admin via env (SETUP_CHECKLIST: founder's id). */
export function adminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Admin = role column OR ADMIN_USER_IDS. The founder holds the commentator
 * role (a profile has one role) and gets admin powers from the env list.
 */
export function isAdmin(userId: string | null | undefined, profile: Profile | null): boolean {
  if (profile?.role === "admin") return true;
  return userId != null && adminUserIds().includes(userId);
}
