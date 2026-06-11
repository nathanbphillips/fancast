/**
 * Chat panel shell (Phase 1: static placeholder messages, disabled input).
 * Message anatomy per docs/DESIGN.md:
 * [vote arrows + net count] [username] [body] — arrows always visible.
 * Commentator variant: gold left border, gold username, COMMENTATOR badge.
 */

type Message = {
  id: number;
  user: string;
  body: string;
  votes: number;
  kind?: "commentator" | "own" | "hidden";
};

const PLACEHOLDER_MESSAGES: Message[] = [
  { id: 1, user: "gunner_steve", body: "That press from Ødegaard was unreal", votes: 4 },
  {
    id: 2,
    user: "ClockEndKev",
    body: "Saliba just pocketed him again. Quietly the best in the league.",
    votes: 12,
    kind: "commentator",
  },
  { id: 3, user: "north_bank_nat", body: "Anyone else's stream about 40s behind?", votes: 2, kind: "own" },
  { id: 4, user: "", body: "", votes: 0, kind: "hidden" },
  { id: 5, user: "highbury_holly", body: "Corner coming up, watch the near post", votes: 7 },
];

function VoteArrows({ votes }: { votes: number }) {
  return (
    <span className="flex shrink-0 flex-col items-center text-secondary">
      <button type="button" aria-label="Upvote" disabled className="flex h-5 w-6 items-center justify-center hover:text-green disabled:opacity-70">
        <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 fill-current"><path d="M6 0l6 8H0z" /></svg>
      </button>
      <span className="text-xs font-semibold tabular-nums">{votes}</span>
      <button type="button" aria-label="Downvote" disabled className="flex h-5 w-6 items-center justify-center hover:text-red disabled:opacity-70">
        <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 fill-current"><path d="M6 8L0 0h12z" /></svg>
      </button>
    </span>
  );
}

function ChatMessage({ message }: { message: Message }) {
  if (message.kind === "hidden") {
    return (
      <li className="rounded-lg px-3 py-2 text-xs text-secondary italic">
        Message hidden by community flags
      </li>
    );
  }

  const isCommentator = message.kind === "commentator";

  return (
    <li
      className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
        isCommentator
          ? "border-l-[3px] border-gold bg-raised"
          : message.kind === "own"
            ? "bg-raised/60"
            : ""
      }`}
    >
      <VoteArrows votes={message.votes} />
      <p className="min-w-0 text-sm leading-relaxed">
        <span className={`mr-2 font-semibold ${isCommentator ? "text-gold" : "text-secondary"}`}>
          {message.user}
        </span>
        {isCommentator && (
          <span className="mr-2 rounded-sm bg-gold px-1 py-0.5 align-middle text-[10px] font-bold text-canvas">
            COMMENTATOR
          </span>
        )}
        {message.body}
      </p>
    </li>
  );
}

export function ChatPanel({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {PLACEHOLDER_MESSAGES.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
      </ul>
      {!signedIn ? (
        /* anonymous read access (FR-2.4): inputs replaced by a join prompt */
        <div className="border-t border-line p-3">
          <div className="rounded-xl border-[0.75px] border-line bg-raised p-4 text-center">
            <p className="text-sm text-secondary">
              You&apos;re listening as a guest. Join in to chat, vote, ask
              questions, and request to talk.
            </p>
            <a
              href="/signin"
              className="mt-3 inline-flex h-11 items-center rounded-lg bg-red px-5 text-sm font-semibold text-white"
            >
              Sign in to join
            </a>
          </div>
        </div>
      ) : (
        <div className="border-t border-line p-3">
        <div className="flex gap-2">
          <input
            type="text"
            disabled
            placeholder="Chat opens in Phase 3"
            aria-label="Chat message"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary disabled:opacity-60"
          />
          <button
            type="button"
            disabled
            className="h-11 shrink-0 rounded-lg bg-red px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            Send
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button type="button" disabled className="h-11 flex-1 rounded-lg border border-line bg-surface text-sm disabled:opacity-60">
            Ask Question
          </button>
          <button type="button" disabled className="h-11 flex-1 rounded-lg border border-line bg-surface text-sm disabled:opacity-60">
            Request to Talk
          </button>
        </div>
        <div className="mt-3 px-1">
          <label htmlFor="pref-slider" className="flex justify-between text-xs text-secondary">
            <span>More commentary</span>
            <span>More discussion</span>
          </label>
          <input
            id="pref-slider"
            type="range"
            min={0}
            max={100}
            defaultValue={50}
            disabled
            className="mt-1 h-2 w-full accent-(--gold) disabled:opacity-60"
          />
        </div>
        </div>
      )}
    </div>
  );
}
