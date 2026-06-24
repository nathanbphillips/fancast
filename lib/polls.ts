import type { SupabaseClient } from "@supabase/supabase-js";
import type { PollState } from "@/lib/db/types";

/**
 * Half-time poll (FR-12.2). One active poll per room (creating a new one closes
 * the prior). Tallies are computed on read (no denormalized counters) and the
 * full PollState rides the control channel. Shared by the route, the room page,
 * and the snapshot endpoint so the state is computed identically everywhere.
 */

/** Vote counts per option index. Pure. */
export function pollResults(
  votes: { option_idx: number }[],
  optionCount: number,
): { results: number[]; total: number } {
  const results = new Array(optionCount).fill(0) as number[];
  for (const v of votes) {
    if (v.option_idx >= 0 && v.option_idx < optionCount) results[v.option_idx]++;
  }
  return { results, total: votes.length };
}

/** The room's latest poll with live tallies, or null if none. */
export async function loadActivePoll(
  service: SupabaseClient,
  roomId: string,
): Promise<PollState> {
  const { data: poll } = await service
    .from("polls")
    .select("id, question, options, status")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      question: string;
      options: string[];
      status: "open" | "closed";
    }>();
  if (!poll) return null;

  const { data: votes } = await service
    .from("poll_votes")
    .select("option_idx")
    .eq("poll_id", poll.id);
  const { results, total } = pollResults(votes ?? [], poll.options.length);
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options,
    status: poll.status,
    results,
    total,
  };
}
