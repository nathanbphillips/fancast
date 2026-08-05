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
    const seen = new Map<string, number>();
    let sent = 0;
    const CAP = 60;
    const PER_SIGNATURE = 3; // keep a few of each so a recurring fault shows up
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
      const n = seen.get(sig) ?? 0;
      if (n >= PER_SIGNATURE) return;
      seen.set(sig, n + 1);
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

    // FAILED API CALLS. This is the important one: almost nothing that actually
    // goes wrong here throws. A 409 "you're already on air", a 404 from the
    // end-call route, a request whose error the UI swallows — all are handled
    // code paths, so an uncaught-exception listener never sees them and the
    // diagnostics page stayed empty through a whole broken live test. Wrap fetch
    // and record any non-OK response from our own API, with the server's reason.
    const origFetch = window.fetch;
    const ours = (u: string) =>
      u.startsWith("/api/") ||
      (typeof location !== "undefined" &&
        u.startsWith(`${location.origin}/api/`));
    // never report the telemetry sink itself — that would recurse
    const isSink = (u: string) => u.includes("/api/events");

    const patched: typeof window.fetch = async (input, init) => {
      let url = "";
      let method = "GET";
      try {
        url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        method = (
          init?.method ??
          (input instanceof Request ? input.method : "GET")
        ).toUpperCase();
      } catch {
        /* fall through with defaults */
      }
      const track_it = ours(url) && !isSink(url);
      try {
        const res = await origFetch(input as RequestInfo, init);
        if (track_it && !res.ok) {
          let serverError: string | undefined;
          try {
            // clone so the caller's own body read is untouched
            serverError = (await res.clone().json())?.error;
          } catch {
            /* non-JSON body */
          }
          const path = url.replace(location.origin, "").split("?")[0];
          report("api_error", `${method} ${path} -> ${res.status}`, {
            route: path,
            method,
            status: res.status,
            serverError,
          });
        }
        return res;
      } catch (err) {
        // the request never completed (offline, DNS, CORS, aborted)
        if (track_it) {
          const path = url.replace(location.origin, "").split("?")[0];
          report("api_unreachable", `${method} ${path} failed`, {
            route: path,
            method,
            message: String((err as Error)?.message ?? err),
          });
        }
        throw err;
      }
    };
    window.fetch = patched;

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      // only restore if nothing else wrapped fetch after us
      if (window.fetch === patched) window.fetch = origFetch;
    };
  }, []);

  return null;
}
