"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

/**
 * Minimal app-wide toast (functional hardening). Listener write paths — votes,
 * the preference slider, predictor, poll, ratings, follow — happen far from any
 * composer and have no room for inline error text. When one fails we surface a
 * brief, dismissable toast so the action never fails silently. Composer errors
 * (chat send, link submit) keep their inline notices, which sit next to the
 * input. Top-centred so it clears the bottom audio bar in a room.
 */

type Tone = "error" | "info";
type ToastItem = { id: number; message: string; tone: Tone };
type ToastFn = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ToastFn | null>(null);

/**
 * Returns the toast dispatcher. Falls back to a no-op outside a provider so a
 * write path can call it unconditionally without ever throwing.
 */
export function useToast(): ToastFn {
  return useContext(ToastContext) ?? noop;
}

const noop: ToastFn = () => {};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback<ToastFn>((message, tone = "error") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 4rem)" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto max-w-sm rounded-lg border px-4 py-2 text-sm shadow-lg ${
              t.tone === "error"
                ? "border-red/40 bg-surface text-red"
                : "border-line bg-surface text-primary"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
