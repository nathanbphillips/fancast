/**
 * Lightweight user-agent parser for the admin diagnostics page (2026-08-05).
 * Turns a raw UA string into a readable browser / OS / device-type summary so a
 * bug report or client error can be tied to the device that hit it, without a
 * dependency. Heuristic (covers the common desktop + mobile browsers); the raw
 * UA is always shown alongside, so nothing is lost.
 */
export type ParsedUA = {
  browser: string;
  os: string;
  device: "mobile" | "tablet" | "desktop";
  label: string;
};

export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  const s = ua ?? "";
  const has = (re: RegExp) => re.test(s);

  // ---- OS ----
  let os = "Unknown OS";
  let osVer = "";
  if (has(/iPhone|iPad|iPod/)) {
    os = "iOS";
    const m = s.match(/OS (\d+[_.]\d+)/);
    if (m) osVer = m[1].replace(/_/g, ".");
  } else if (has(/Android/)) {
    os = "Android";
    const m = s.match(/Android (\d+(?:\.\d+)?)/);
    if (m) osVer = m[1];
  } else if (has(/Windows NT/)) {
    os = "Windows";
    const m = s.match(/Windows NT (\d+\.\d+)/);
    const map: Record<string, string> = {
      "10.0": "10/11",
      "6.3": "8.1",
      "6.2": "8",
      "6.1": "7",
    };
    if (m) osVer = map[m[1]] ?? m[1];
  } else if (has(/Mac OS X/)) {
    os = "macOS";
    const m = s.match(/Mac OS X (\d+[_.]\d+)/);
    if (m) osVer = m[1].replace(/_/g, ".");
  } else if (has(/CrOS/)) {
    os = "ChromeOS";
  } else if (has(/Linux/)) {
    os = "Linux";
  }

  // ---- browser (order matters: wrappers before the base engine) ----
  let browser = "Unknown browser";
  let bVer = "";
  const ver = (re: RegExp) => {
    const m = s.match(re);
    if (m) bVer = m[1];
  };
  if (has(/Edg(A|iOS)?\//)) {
    browser = "Edge";
    ver(/Edg(?:A|iOS)?\/(\d+)/);
  } else if (has(/OPR\/|Opera/)) {
    browser = "Opera";
    ver(/OPR\/(\d+)/);
  } else if (has(/SamsungBrowser/)) {
    browser = "Samsung Internet";
    ver(/SamsungBrowser\/(\d+)/);
  } else if (has(/Firefox\/|FxiOS/)) {
    browser = "Firefox";
    ver(/(?:Firefox|FxiOS)\/(\d+)/);
  } else if (has(/CriOS/)) {
    browser = "Chrome"; // Chrome on iOS
    ver(/CriOS\/(\d+)/);
  } else if (has(/Chrome\//)) {
    browser = "Chrome";
    ver(/Chrome\/(\d+)/);
  } else if (has(/Version\/.*Safari/)) {
    browser = "Safari";
    ver(/Version\/(\d+)/);
  } else if (has(/Safari\//)) {
    browser = "Safari";
  }

  // ---- device type ----
  let device: ParsedUA["device"] = "desktop";
  if (has(/iPad/) || (has(/Android/) && !has(/Mobile/)) || has(/Tablet/)) {
    device = "tablet";
  } else if (has(/Mobi|iPhone|iPod/) || (has(/Android/) && has(/Mobile/))) {
    device = "mobile";
  }

  const osStr = osVer ? `${os} ${osVer}` : os;
  const bStr = bVer ? `${browser} ${bVer}` : browser;
  return { browser: bStr, os: osStr, device, label: `${bStr} · ${osStr} · ${device}` };
}
