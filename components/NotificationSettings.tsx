"use client";

import { useState } from "react";

/**
 * Notifications settings (FR-21.2/21.5): every type with its two toggles, plus
 * a per-device push enable. Toggles PATCH one channel at a time; push
 * registration subscribes via the service worker + VAPID public key.
 */

export type PrefRow = {
  type: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
};

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationSettings({ initial }: { initial: PrefRow[] }) {
  const [rows, setRows] = useState(initial);
  const [pushState, setPushState] = useState<
    "idle" | "working" | "on" | "unsupported" | "denied" | "error"
  >("idle");

  async function toggle(type: string, channel: "email" | "push", value: boolean) {
    setRows((rs) =>
      rs.map((r) => (r.type === type ? { ...r, [channel]: value } : r)),
    );
    const res = await fetch("/api/notification-prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, channel, enabled: value }),
    }).catch(() => null);
    if (!res?.ok) {
      // roll back on failure
      setRows((rs) =>
        rs.map((r) => (r.type === type ? { ...r, [channel]: !value } : r)),
      );
    }
  }

  async function enablePush() {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !vapid
    ) {
      setPushState("unsupported");
      return;
    }
    setPushState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });
      setPushState(res.ok ? "on" : "error");
    } catch {
      setPushState("error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold">Push on this device</p>
          <p className="mt-0.5 text-[13px] text-secondary">
            {pushState === "on"
              ? "Push is enabled on this device."
              : pushState === "denied"
                ? "Notifications are blocked in your browser settings."
                : pushState === "unsupported"
                  ? "This browser or context doesn't support web push. On iOS, install the app to your home screen first."
                  : "Get alerts even when the tab is closed."}
          </p>
        </div>
        {pushState !== "on" && (
          <button
            type="button"
            onClick={() => void enablePush()}
            disabled={pushState === "working"}
            className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-raised disabled:opacity-60"
          >
            {pushState === "working" ? "Enabling…" : "Enable push"}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border-[0.75px] border-line">
        <div className="flex items-center gap-3 border-b border-line bg-raised/50 px-3 py-2 font-mono text-[10px] tracking-wider text-secondary uppercase">
          <span className="flex-1">Notification</span>
          <span className="w-14 text-center">Email</span>
          <span className="w-14 text-center">Push</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.type}
            className="flex items-center gap-3 border-t border-line/60 px-3 py-2.5 first:border-t-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">{r.label}</span>
              <span className="block text-[12px] text-secondary">
                {r.description}
              </span>
            </span>
            <span className="flex w-14 justify-center">
              <input
                type="checkbox"
                checked={r.email}
                onChange={(e) => void toggle(r.type, "email", e.target.checked)}
                aria-label={`${r.label} email`}
                className="h-4 w-4 accent-(--red)"
              />
            </span>
            <span className="flex w-14 justify-center">
              <input
                type="checkbox"
                checked={r.push}
                onChange={(e) => void toggle(r.type, "push", e.target.checked)}
                aria-label={`${r.label} push`}
                className="h-4 w-4 accent-(--red)"
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
