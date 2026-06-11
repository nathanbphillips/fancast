"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/client";

export function UserMenu({ username }: { username: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/u/${username}`}
        className="flex h-11 items-center rounded-lg px-2 text-sm font-semibold hover:bg-raised"
      >
        {username}
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="flex h-11 items-center rounded-lg px-2 text-sm text-secondary hover:bg-raised hover:text-primary"
      >
        Sign out
      </button>
    </div>
  );
}
