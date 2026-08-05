import { parseUserAgent } from "@/lib/ua";

export type DiagRow = {
  id: string;
  created_at: string;
  event: string;
  user_id: string | null;
  session_id: string | null;
  room_id: string | null;
  path: string | null;
  props: Record<string, unknown> | null;
};

/** props rendered as their own field rather than in the generic meta list */
const SPECIAL = new Set([
  "kind",
  "message",
  "stack",
  "ua",
  "source",
  "serverError",
]);

function headline(r: DiagRow): string {
  const p = r.props ?? {};
  if (typeof p.message === "string" && p.message) return p.message;
  if (r.event === "callin_mic_timeout") return "Mic start timed out";
  if (r.event === "callin_mic_failed") return `Mic failed: ${p.name ?? "unknown"}`;
  if (r.event === "audio_connect_failed") return "Audio connect failed";
  return r.event;
}

/** the label shown on the type chip: the kind for wrapped client errors,
 *  otherwise the raw event name */
function kindOf(r: DiagRow): string {
  const k = (r.props ?? {}).kind;
  return typeof k === "string" && k ? k : r.event;
}

const CHIP: Record<string, string> = {
  api_error: "text-gold-bright border-gold-bright/50",
  api_unreachable: "text-gold-bright border-gold-bright/50",
  error: "text-red border-red/50",
  unhandledrejection: "text-red border-red/50",
  callin_mic_timeout: "text-red border-red/50",
  callin_mic_failed: "text-red border-red/50",
  audio_connect_failed: "text-red border-red/50",
};

function Count({ label, map }: { label: string; map: Map<string, number> }) {
  if (map.size === 0) return null;
  return (
    <p className="mt-1">
      <span className="text-tertiary">{label}</span>{" "}
      {[...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(" · ")}
    </p>
  );
}

/**
 * Admin diagnostics catalog. Renders EVERY captured diagnostic event with its
 * full context, not just uncaught exceptions — the failures that actually
 * happen (a 409 from an API, a request whose error the UI swallowed, a mic start
 * that hung and never threw) are all handled paths, which is why an
 * uncaught-error-only view stayed empty through a broken live test. Props are
 * rendered generically so a newly added event type shows up here with no work.
 */
export function AdminDiagnostics({
  initial,
  usernames,
}: {
  initial: DiagRow[];
  usernames: Record<string, string>;
}) {
  if (initial.length === 0) {
    return (
      <p className="mt-3 text-sm text-secondary">
        Nothing captured yet. This records failed API calls, uncaught errors,
        promise rejections, and audio/call-in faults.
      </p>
    );
  }

  const byKind = new Map<string, number>();
  const byRoute = new Map<string, number>();
  const byBrowser = new Map<string, number>();
  const sessions = new Set<string>();
  for (const r of initial) {
    const k = kindOf(r);
    byKind.set(k, (byKind.get(k) ?? 0) + 1);
    const p = r.props ?? {};
    if (typeof p.route === "string") {
      const key = `${p.route} ${p.status ?? ""}`.trim();
      byRoute.set(key, (byRoute.get(key) ?? 0) + 1);
    }
    if (typeof p.ua === "string") {
      const b = parseUserAgent(p.ua).browser;
      byBrowser.set(b, (byBrowser.get(b) ?? 0) + 1);
    }
    if (r.session_id) sessions.add(r.session_id);
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs text-secondary">
        <p>
          <b className="text-primary tabular-nums">{initial.length}</b> captured ·{" "}
          {sessions.size} session{sessions.size === 1 ? "" : "s"}
        </p>
        <Count label="types" map={byKind} />
        <Count label="routes" map={byRoute} />
        <Count label="browsers" map={byBrowser} />
      </div>

      <ul className="space-y-2.5">
        {initial.map((r) => {
          const p = r.props ?? {};
          const kind = kindOf(r);
          const dev = typeof p.ua === "string" ? parseUserAgent(p.ua) : null;
          const who = r.user_id ? usernames[r.user_id] : null;
          const meta = Object.entries(p).filter(
            ([k, v]) =>
              !SPECIAL.has(k) && v !== undefined && v !== null && v !== "",
          );
          return (
            <li key={r.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
                <span
                  className={`rounded-full border bg-raised px-2 py-0.5 font-mono text-[10px] font-bold ${
                    CHIP[kind] ?? "border-line text-secondary"
                  }`}
                >
                  {kind}
                </span>
                <span className="tabular-nums">
                  {r.created_at.slice(0, 19).replace("T", " ")}
                </span>
                {who && <span>· @{who}</span>}
                {dev && (
                  <span className="rounded-full border border-line px-2 py-0.5 font-semibold text-primary">
                    {dev.label}
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm break-words">{headline(r)}</p>
              {typeof p.serverError === "string" && (
                <p className="mt-1 text-[13px] text-red">
                  server said: {p.serverError}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
                {r.path && (
                  <span>
                    <span className="text-tertiary">page</span>{" "}
                    <span className="text-secondary">{r.path}</span>
                  </span>
                )}
                {meta.map(([k, v]) => (
                  <span key={k}>
                    <span className="text-tertiary">{k}</span>{" "}
                    <span className="font-semibold text-secondary">
                      {String(v).slice(0, 80)}
                    </span>
                  </span>
                ))}
                {r.room_id && (
                  <span>
                    <span className="text-tertiary">room</span>{" "}
                    <span className="text-secondary">
                      {r.room_id.slice(0, 8)}
                    </span>
                  </span>
                )}
                {r.session_id && (
                  <span>
                    <span className="text-tertiary">session</span>{" "}
                    <span className="text-secondary">
                      {r.session_id.slice(0, 8)}
                    </span>
                  </span>
                )}
              </div>

              {typeof p.source === "string" && (
                <p className="mt-1 font-mono text-[10px] break-all text-tertiary">
                  {p.source}
                </p>
              )}
              {typeof p.ua === "string" && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer font-mono text-[10px] text-tertiary hover:text-secondary">
                    raw user-agent
                  </summary>
                  <p className="mt-1 font-mono text-[10px] break-all text-secondary">
                    {p.ua}
                  </p>
                </details>
              )}
              {typeof p.stack === "string" && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer font-mono text-[10px] text-tertiary hover:text-secondary">
                    stack
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-inset p-2 font-mono text-[10px] whitespace-pre-wrap text-secondary">
                    {p.stack}
                  </pre>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
