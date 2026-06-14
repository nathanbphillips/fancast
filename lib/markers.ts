import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClockAction } from "./clock";

/**
 * Segment markers (FR-13). Boundaries are emitted automatically by the
 * lifecycle: Start Broadcast opens the outermost span, each clock
 * transition marks a period boundary, End Broadcast closes it. `label`
 * names the segment that BEGINS at the marker.
 */

export type MarkerKind =
  | "broadcast_start"
  | "start_1h"
  | "stop_1h"
  | "start_2h"
  | "stop_2h"
  | "start_et"
  | "stop_et"
  | "broadcast_end"
  | "manual";

export type Marker = {
  id: string;
  room_id: string;
  kind: MarkerKind;
  label: string;
  source: "auto" | "manual";
  server_ts: string;
  adjusted_ts: string | null;
};

/** The segment that begins at each boundary kind. */
export const SEGMENT_LABEL: Record<MarkerKind, string | null> = {
  broadcast_start: "Pre-game show",
  start_1h: "First half",
  stop_1h: "Halftime show",
  start_2h: "Second half",
  stop_2h: "Post-game show",
  start_et: "Extra time",
  stop_et: "Post-game show",
  broadcast_end: null, // closes the outermost span
  manual: "Segment",
};

const CLOCK_TO_KIND: Record<ClockAction, MarkerKind | null> = {
  start1h: "start_1h",
  stop1h: "stop_1h",
  start2h: "start_2h",
  stop2h: "stop_2h",
  start_et: "start_et",
  stop_et: "stop_et",
  adjust: null, // ±1s clock nudge isn't a segment boundary
};

const MERGE_WINDOW_MS = 30_000;
const MIN_SEGMENT_SECONDS = 2;

export async function emitMarker(
  service: SupabaseClient,
  roomId: string,
  kind: MarkerKind,
  serverTs: string,
  source: "auto" | "manual" = "auto",
  label?: string,
): Promise<void> {
  // 30s merge rule (FR-13.3): a manual mark within 30s of an existing
  // boundary of the same kind merges into it (no duplicate).
  if (source === "manual") {
    const since = new Date(new Date(serverTs).getTime() - MERGE_WINDOW_MS).toISOString();
    const until = new Date(new Date(serverTs).getTime() + MERGE_WINDOW_MS).toISOString();
    const { data: near } = await service
      .from("broadcast_markers")
      .select("id")
      .eq("room_id", roomId)
      .eq("kind", kind)
      .gte("server_ts", since)
      .lte("server_ts", until)
      .limit(1);
    if (near && near.length > 0) return;
  }
  await service.from("broadcast_markers").insert({
    room_id: roomId,
    kind,
    label: label ?? SEGMENT_LABEL[kind] ?? "Segment",
    source,
    server_ts: serverTs,
  });
}

export async function emitClockMarker(
  service: SupabaseClient,
  roomId: string,
  action: ClockAction,
  serverTs: string,
): Promise<void> {
  const kind = CLOCK_TO_KIND[action];
  if (kind) await emitMarker(service, roomId, kind, serverTs, "auto");
}

export type DerivedSegment = {
  idx: number;
  label: string;
  startOffset: number; // seconds from recording start
  endOffset: number;
};

/**
 * Build the ordered segment list from markers. Offsets are seconds from
 * the recording start; the commentator's ±2min adjustment (adjusted_ts)
 * wins over server_ts. Sub-2s spans and adjacent same-label spans are
 * merged so a brief post-game sliver before extra time doesn't appear.
 */
export function deriveSegments(
  markers: Pick<Marker, "kind" | "label" | "server_ts" | "adjusted_ts">[],
  recordingStartMs: number,
  recordingEndMs: number,
): DerivedSegment[] {
  const effective = (m: { server_ts: string; adjusted_ts: string | null }) =>
    new Date(m.adjusted_ts ?? m.server_ts).getTime();

  const ordered = [...markers].sort((a, b) => effective(a) - effective(b));

  // boundary points in seconds-from-start, each carrying the label of the
  // segment that begins there (broadcast_end carries null)
  type Boundary = { at: number; label: string | null };
  const boundaries: Boundary[] = ordered.map((m) => ({
    at: Math.max(0, (effective(m) - recordingStartMs) / 1000),
    label: SEGMENT_LABEL[m.kind as MarkerKind] ?? m.label,
  }));

  // ensure an opening boundary at 0 and a closing boundary at end
  if (boundaries.length === 0 || boundaries[0].at > 0.5) {
    boundaries.unshift({ at: 0, label: "Pre-game show" });
  }
  const endOffset = Math.max(0, (recordingEndMs - recordingStartMs) / 1000);
  boundaries.push({ at: endOffset, label: null });

  const segments: DerivedSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (start.label === null) continue; // a close with nothing after
    const span = end.at - start.at;
    if (span < MIN_SEGMENT_SECONDS) continue; // drop slivers
    const prev = segments[segments.length - 1];
    if (prev && prev.label === start.label) {
      // merge adjacent same-label spans (e.g. post-game split by ET)
      prev.endOffset = end.at;
      continue;
    }
    segments.push({
      idx: segments.length + 1,
      label: start.label,
      startOffset: start.at,
      endOffset: end.at,
    });
  }
  // renumber after merges/drops
  segments.forEach((s, i) => (s.idx = i + 1));
  return segments;
}
