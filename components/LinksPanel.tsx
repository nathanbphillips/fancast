/**
 * Links feed shell (Phase 1: static placeholder cards).
 * Submission, server-side OG unfurl, votes, and hiding arrive in Phase 3.
 */

const PLACEHOLDER_LINKS = [
  {
    id: 1,
    title: "Arteta on the title run-in: \"One match at a time\"",
    domain: "arsenal.com",
    votes: 9,
  },
  {
    id: 2,
    title: "Thread: every Saliba duel this half, annotated",
    domain: "bsky.app",
    votes: 5,
  },
  {
    id: 3,
    title: "xG race chart, updated live",
    domain: "understat.com",
    votes: 3,
  },
];

export function LinksPanel() {
  return (
    <div className="space-y-2 p-3">
      <div className="flex gap-2">
        <input
          type="url"
          disabled
          placeholder="Paste a link (Phase 3)"
          aria-label="Submit a link"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary disabled:opacity-60"
        />
      </div>
      <ul className="space-y-2">
        {PLACEHOLDER_LINKS.map((link) => (
          <li
            key={link.id}
            className="flex items-center gap-3 rounded-xl border-[0.75px] border-line bg-surface p-3"
          >
            <span className="h-10 w-10 shrink-0 rounded-lg bg-raised" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{link.title}</p>
              <p className="text-xs text-secondary">{link.domain}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-green tabular-nums">
              ▲ {link.votes}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
