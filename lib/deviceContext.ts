/**
 * Snapshot of the viewer's device/browser context for diagnostics (2026-08-05).
 * Collected client-side and attached to client_error events (and reusable by the
 * bug reporter) so the admin diagnostics page can show the fullest picture of
 * the environment a failure happened in: viewport vs screen, pixel ratio,
 * language, platform, network type, memory, cores, online state. Best-effort:
 * every field is optional and wrapped so it can never throw. Compact keys keep
 * the event payload small.
 */
export type DeviceContext = {
  vw?: number; // viewport width (CSS px)
  vh?: number; // viewport height
  sw?: number; // screen width
  sh?: number; // screen height
  dpr?: number; // device pixel ratio
  lang?: string; // primary language
  platform?: string; // OS platform hint
  online?: boolean; // navigator.onLine
  conn?: string; // network effectiveType (4g / 3g / slow-2g …)
  mem?: number; // deviceMemory (GB, coarse)
  cores?: number; // logical CPU cores
};

export function collectDeviceContext(): DeviceContext {
  try {
    if (typeof window === "undefined") return {};
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string };
      mozConnection?: { effectiveType?: string };
      webkitConnection?: { effectiveType?: string };
      deviceMemory?: number;
      userAgentData?: { platform?: string };
    };
    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      sw: window.screen?.width,
      sh: window.screen?.height,
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
      lang: navigator.language,
      platform: nav.userAgentData?.platform || navigator.platform,
      online: navigator.onLine,
      conn: conn?.effectiveType,
      mem: nav.deviceMemory,
      cores: navigator.hardwareConcurrency,
    };
  } catch {
    return {};
  }
}
