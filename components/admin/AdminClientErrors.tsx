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
  } | null;
};

/**
 * Read-only admin view of client-side errors captured during a session (event
 * "client_error" from ClientErrorReporter → /api/events). Built for the live
 * test (2026-08-05): shows the message + device/user-agent + path per
 * occurrence, newest first, so a browser/device failure is visible without SQL.
 */
export function AdminClientErrors({ initial }: { initial: ClientErrorRow[] }) {
  if (initial.length === 0) {
    return (
      <p className="mt-3 text-sm text-secondary">
        No client errors captured. 🎉
      </p>
    );
  }
  const distinct = new Set(
    initial.map((e) => (e.props?.message ?? "").slice(0, 200)),
  ).size;

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-secondary">
        {initial.length} captured · {distinct} distinct message
        {distinct === 1 ? "" : "s"} (most recent first)
      </p>
      <ul className="space-y-3">
        {initial.map((e) => (
          <li key={e.id} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
              <span className="rounded-full bg-raised px-2 py-0.5 font-semibold text-red">
                {e.props?.kind ?? "error"}
              </span>
              <span>· {e.created_at.slice(0, 16).replace("T", " ")}</span>
            </div>
            <p className="mt-2 text-sm break-words">
              {e.props?.message || "(no message)"}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-tertiary">
              {e.path && <span>{e.path}</span>}
              {e.props?.source && (
                <span className="max-w-[280px] truncate" title={e.props.source}>
                  {e.props.source}
                </span>
              )}
              {e.props?.ua && (
                <span className="max-w-[340px] truncate" title={e.props.ua}>
                  {e.props.ua}
                </span>
              )}
            </div>
            {e.props?.stack && (
              <pre className="mt-2 max-h-28 overflow-auto rounded bg-inset p-2 font-mono text-[10px] whitespace-pre-wrap text-secondary">
                {e.props.stack}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
