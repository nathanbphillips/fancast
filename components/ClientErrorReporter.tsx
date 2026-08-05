"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";
import { collectDeviceContext } from "@/lib/deviceContext";

/**
 * Client-side error telemetry for the live test (2026-08-05). Captures uncaught
 * errors + unhandled promise rejections in the viewer's browser and beacons them
 * to /api/events (event "client_error") via track(), so the team can SEE what
 * fails on a specific device/browser/country during the session instead of
 * flying blind. Deduped + capped per session so it can never flood the sink,
 * and wrapped so telemetry never breaks the app. Includes the user-agent so a
 * failure can be tied to the device that hit it.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    let sent = 0;
    const CAP = 20;
    // one device/environment snapshot per session, attached to every report so
    // the admin diagnostics page has the fullest picture of where it happened
    const ctx = collectDeviceContext();

    const report = (
      kind: string,
      message: string,
      extra: Record<string, unknown>,
    ) => {
      if (sent >= CAP) return;
      const sig = `${kind}:${message}`.slice(0, 200);
      if (seen.has(sig)) return;
      seen.add(sig);
      sent += 1;
      try {
        track("client_error", {
          props: {
            kind,
            message: message.slice(0, 300),
            ua:
              typeof navigator !== "undefined"
                ? navigator.userAgent.slice(0, 400)
                : undefined,
            ...ctx,
            ...extra,
          },
        });
      } catch {
        /* never let telemetry throw */
      }
    };

    const onError = (e: ErrorEvent) => {
      report("error", String(e.message ?? "unknown"), {
        source: e.filename
          ? `${e.filename}:${e.lineno}:${e.colno}`
          : undefined,
        stack:
          e.error && e.error.stack
            ? String(e.error.stack).slice(0, 800)
            : undefined,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | undefined;
      report("unhandledrejection", String(r?.message ?? r ?? "unknown"), {
        stack: r?.stack ? String(r.stack).slice(0, 800) : undefined,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
