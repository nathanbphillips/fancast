"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker and shows a gentle install prompt — but
 * only after the user has been through a completed session (FR-5.2),
 * and never twice.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWASetup() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      try {
        const earned = localStorage.getItem("fc_session_completed") === "1";
        const dismissed = localStorage.getItem("fc_install_dismissed") === "1";
        if (earned && !dismissed) setShow(true);
      } catch {
        // storage unavailable — skip the prompt entirely
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show || !installEvent) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 lg:bottom-auto lg:top-16 lg:right-4 lg:left-auto lg:w-80">
      <div className="rounded-xl border-[0.75px] border-line bg-surface p-4 shadow-lg">
        <p className="text-sm font-semibold">Enjoyed the show?</p>
        <p className="mt-1 text-sm text-secondary">
          Add the app to your home screen for one-tap access on match days.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              setShow(false);
              await installEvent.prompt();
            }}
            className="h-11 flex-1 rounded-lg bg-red text-sm font-semibold text-white"
          >
            Add to home screen
          </button>
          <button
            type="button"
            onClick={() => {
              setShow(false);
              try {
                localStorage.setItem("fc_install_dismissed", "1");
              } catch {}
            }}
            className="h-11 rounded-lg border border-line px-3 text-sm"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
