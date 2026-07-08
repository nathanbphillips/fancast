"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/lib/brand";
import {
  COMMENTATOR_TERMS,
  COMMENTATOR_TERMS_VERSION,
} from "@/lib/commentator-terms";
import { Button } from "@/components/ui/Button";

/**
 * Self-serve commentator upgrade (FR-18.1): explain hosting, present the
 * commentator terms, require the checkbox, then POST /api/commentator/upgrade.
 * Renders inside settings (and is linked from the user's own profile).
 */
export function CommentatorUpgrade() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/commentator/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        termsVersion: COMMENTATOR_TERMS_VERSION,
        accepted: true,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error ?? "Couldn't complete the upgrade. Try again.");
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold">Become a commentator</p>
          <p className="mt-0.5 text-[13px] text-secondary">
            Host live rooms for matches: your voice, your show, your recordings.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Get started
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold">Become a commentator</p>
        <p className="mt-0.5 text-[13px] text-secondary">
          Hosting means you schedule rooms against real fixtures, go on air for
          the room, and own every recording. Read the terms, tick the box, and
          you can host today.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border-[0.75px] border-line bg-raised p-4">
        {COMMENTATOR_TERMS.map((t) => (
          <div key={t.heading}>
            <p className="text-[13px] font-bold">{t.heading}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-secondary">
              {t.body}
            </p>
          </div>
        ))}
        <p className="font-mono text-[10px] tracking-wide text-secondary uppercase">
          Terms version {COMMENTATOR_TERMS_VERSION} · {brand.name}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red/40 bg-inset px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}

      <label className="flex items-start gap-2 text-[13px] leading-relaxed">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-(--red)"
        />
        <span>
          I've read and agree to the commentator terms above and the{" "}
          <a href="/guidelines" className="underline hover:text-primary">
            community guidelines
          </a>
          .
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button variant="red" disabled={!accepted || busy} onClick={() => void upgrade()}>
          {busy ? "Upgrading…" : "Become a commentator"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>
    </div>
  );
}
