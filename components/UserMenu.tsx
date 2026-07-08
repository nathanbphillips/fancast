"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/db/client";
import { Avatar } from "@/components/Avatar";

/**
 * Account menu: an avatar that opens a dropdown (profile · admin · sign out),
 * keeping the header chrome to a single icon like the redesign mockup. Closes
 * on outside-click or Escape.
 */
export function UserMenu({
  username,
  avatarUrl,
  admin = false,
  host = false,
}: {
  username: string;
  avatarUrl?: string | null;
  admin?: boolean;
  /** can host rooms: shows the My rooms entry (FR-19) */
  host?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Drop the account-theme cookie so the next anonymous paint uses the
    // device choice / system theme rather than the signed-out user's (M-11).
    document.cookie = "fc_theme=; Max-Age=0; path=/";
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-11 items-center rounded-full px-0.5 hover:bg-raised"
      >
        <Avatar src={avatarUrl} name={username} size={30} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-raised"
        >
          <p className="truncate border-b border-line px-3 py-2 text-sm font-semibold">
            {username}
          </p>
          <Link
            role="menuitem"
            href={`/${username}`}
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-raised"
          >
            Profile
          </Link>
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm hover:bg-raised"
          >
            Edit profile
          </Link>
          {host && (
            <Link
              role="menuitem"
              href="/host"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm hover:bg-raised"
            >
              My rooms
            </Link>
          )}
          {admin && (
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-semibold text-red hover:bg-raised"
            >
              Admin
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-raised hover:text-primary"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
