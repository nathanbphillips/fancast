/**
 * Client-side product telemetry (admin insights). Fire-and-forget: never throws,
 * never blocks the UI, survives an immediate navigation (sendBeacon/keepalive).
 * Writes to /api/events → the `events` table (migration 0041). Import and call
 * `track("event_name", { roomId, props })` from client components only.
 */

let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    let v = localStorage.getItem("fc_sid");
    if (!v) {
      v =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Math.random()).slice(2);
      localStorage.setItem("fc_sid", v);
    }
    sessionId = v;
  } catch {
    sessionId = "nostore";
  }
  return sessionId;
}

export function track(
  event: string,
  opts?: { roomId?: string; props?: Record<string, unknown> },
): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      event,
      roomId: opts?.roomId,
      path: window.location.pathname,
      sessionId: getSessionId(),
      props: opts?.props,
    });
    const url = "/api/events";
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* telemetry must never break the app */
  }
}
