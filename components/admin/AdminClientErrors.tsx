import { parseUserAgent } from "@/lib/ua";

export type ClientErrorRow = {
  id: string;
  created_at: string;
  path: string | null;
  session_id: string | null;
  props: {
    kind?: string;
    message?: string;
    ua?: string;
    source?: string;
    stack?: string;
    // device/environment snapshot (lib/deviceContext.ts)
    vw?: number;
    vh?: number;
    sw?: number;
    sh?: number;
    dpr?: number;
    lang?: string;
    platform?: string;
    online?: boolean;
    conn?: string;
    mem?: number;
    cores?: number;
  } | null;
};

function Meta({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-tertiary">{label}</span>
      <span className="font-semibold text-secondary">{value}</span>
    </span>
  );
}

const breakdown = (m: Map<string, number>) =>
  [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");

/**
 * Admin diagnostics view of client-side errors (event "client_error" from
 * ClientErrorReporter → /api/events). Shows the message + parsed device
 * (browser / OS / type) + the full environment snapshot (viewport vs screen,
 * pixel ratio, network, memory, cores, language, platform, online) + session,
 * path, source and stack, newest first, plus a summary breakdown. The fullest
 * picture of where a failure happened, without SQL (2026-08-05).
 */
export function AdminClientErrors({ initial }: { initial: ClientErrorRow[] }) {
  if (initial.length === 0) {
    return (
      <p className="mt-3 text-sm text-secondary">No client errors captured. 🎉</p>
    );
  }
  const distinct = new Set(
    initial.map((e) => (e.props?.message ?? "").slice(0, 200)),
  ).size;
  const sessions = new Set(
    initial.map((e) => e.session_id).filter(Boolean),
  ).size;
  const browsers = new Map<string, number>();
  const devices = new Map<string, number>();
  for (const e of initial) {
    const p = parseUserAgent(e.props?.ua);
    browsers.set(p.browser, (browsers.get(p.browser) ?? 0) + 1);
    devices.set(p.device, (devices.get(p.device) ?? 0) + 1);
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs text-secondary">
        <p>
          <b className="text-primary tabular-nums">{initial.length}</b> captured ·{" "}
          {distinct} distinct · {sessions} session{sessions === 1 ? "" : "s"}
        </p>
        <p className="mt-1">
          <span className="text-tertiary">browsers</span> {breakdown(browsers)}
        </p>
        <p className="mt-0.5">
          <span className="text-tertiary">devices</span> {breakdown(devices)}
        </p>
      </div>
      <ul className="space-y-3">
        {initial.map((e) => {
          const p = e.props ?? {};
          const dev = parseUserAgent(p.ua);
          const vp = p.vw && p.vh ? `${p.vw}×${p.vh}` : undefined;
          const scr = p.sw && p.sh ? `${p.sw}×${p.sh}` : undefined;
          return (
            <li key={e.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
                <span className="rounded-full bg-raised px-2 py-0.5 font-semibold text-red">
                  {p.kind ?? "error"}
                </span>
                <span>· {e.created_at.slice(0, 16).replace("T", " ")}</span>
                <span className="rounded-full border border-line px-2 py-0.5 font-semibold text-primary">
                  {dev.label}
                </span>
              </div>
              <p className="mt-2 text-sm break-words">
                {p.message || "(no message)"}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
                <Meta label="viewport" value={vp} />
                <Meta label="screen" value={scr} />
                <Meta label="dpr" value={p.dpr} />
                <Meta label="net" value={p.conn} />
                <Meta label="mem" value={p.mem ? `${p.mem}GB` : undefined} />
                <Meta label="cores" value={p.cores} />
                <Meta label="lang" value={p.lang} />
                <Meta label="platform" value={p.platform} />
                <Meta
                  label="online"
                  value={
                    p.online === undefined ? undefined : p.online ? "yes" : "OFFLINE"
                  }
                />
                <Meta
                  label="session"
                  value={e.session_id ? e.session_id.slice(0, 8) : undefined}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-tertiary">
                {e.path && <span>{e.path}</span>}
                {p.source && (
                  <span className="max-w-full break-all" title={p.source}>
                    {p.source}
                  </span>
                )}
              </div>
              {p.ua && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer font-mono text-[10px] text-tertiary hover:text-secondary">
                    raw user-agent
                  </summary>
                  <p className="mt-1 font-mono text-[10px] break-all text-secondary">
                    {p.ua}
                  </p>
                </details>
              )}
              {p.stack && (
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-inset p-2 font-mono text-[10px] whitespace-pre-wrap text-secondary">
                  {p.stack}
                </pre>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
