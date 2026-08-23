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
  | "manual"
  // recording pause/resume (founder 2026-08-22): not segment boundaries -
  // the span between them is EXCLUDED from every produced file
  | "record_pause"
  | "record_resume";

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
  record_pause: null,
  record_resume: null,
};

export const PAUSE_KINDS: ReadonlySet<string> = new Set(["record_pause", "record_resume"]);

/**
 * Paused spans as [start, end) offsets in seconds from the recording start.
 * Pairs up pause/resume in time order; a pause still open at the end closes
 * at the recording end; stray resumes and double pauses are ignored. Pauses
 * are final (no adjusted_ts), so server_ts is the only timestamp that counts.
 */
export function pauseIntervals(
  markers: Pick<Marker, "kind" | "server_ts">[],
  recordingStartMs: number,
  recordingEndMs: number,
): Array<[number, number]> {
  const endOffset = Math.max(0, (recordingEndMs - recordingStartMs) / 1000);
  const ordered = markers
    .filter((m) => PAUSE_KINDS.has(m.kind))
    .sort((a, b) => new Date(a.server_ts).getTime() - new Date(b.server_ts).getTime());
  const out: Array<[number, number]> = [];
  let open: number | null = null;
  for (const m of ordered) {
    const at = (new Date(m.server_ts).getTime() - recordingStartMs) / 1000;
    if (m.kind === "record_pause" && open === null) open = at;
    else if (m.kind === "record_resume" && open !== null) {
      out.push([open, at]);
      open = null;
    }
  }
  if (open !== null) out.push([open, endOffset]);
  return out
    .map(([s, e]): [number, number] => [Math.max(0, Math.min(endOffset, s)), Math.max(0, Math.min(endOffset, e))])
    .filter(([s, e]) => e > s);
}

/** Total paused seconds. */
export function pausedTotal(intervals: Array<[number, number]>): number {
  return intervals.reduce((a, [s, e]) => a + (e - s), 0);
}

/** Is the one-second segment at index `idx` (covering [idx, idx+1)) inside a
 *  paused span? A second is dropped when its midpoint falls in the span, so
 *  a pause lands on whole-second boundaries with no double-counting. */
export function segmentPaused(idx: number, intervals: Array<[number, number]>): boolean {
  return instantPaused(idx + 0.5, intervals);
}

/** Is the instant `atS` (seconds from recording start) inside a paused span? */
export function instantPaused(atS: number, intervals: Array<[number, number]>): boolean {
  return intervals.some(([s, e]) => atS >= s && atS < e);
}

/** One HLS segment as the egress described it in its playlist. */
export type SegmentTiming = {
  idx: number;
  /** wall-clock start (EXT-X-PROGRAM-DATE-TIME), epoch ms */
  startMs: number;
  /** audio seconds in the file (EXTINF) */
  durS: number;
};

/**
 * Parse the egress's `full.m3u8` into per-segment wall-clock timing. The
 * index is "wall second N" only approximately: a 1s AAC segment holds 43
 * frames = 0.99846s, so the index drifts ~5.5s per hour (review 2026-08-23,
 * measured on the Coventry show). The playlist carries the exact start time
 * and duration of every segment, which is what pause exclusion and marker
 * cuts need. Entries without a date tag (or unparseable) are skipped; the
 * caller falls back to index arithmetic for anything missing.
 */
export function parseSegmentPlaylist(text: string): SegmentTiming[] {
  const out: SegmentTiming[] = [];
  let startMs: number | null = null;
  let durS: number | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#EXT-X-PROGRAM-DATE-TIME:")) {
      const t = Date.parse(line.slice("#EXT-X-PROGRAM-DATE-TIME:".length));
      startMs = Number.isFinite(t) ? t : null;
    } else if (line.startsWith("#EXTINF:")) {
      const d = parseFloat(line.slice("#EXTINF:".length));
      durS = Number.isFinite(d) && d > 0 ? d : null;
    } else if (line && !line.startsWith("#")) {
      const m = line.match(/seg_(\d+)\.ts$/);
      if (m && startMs !== null && durS !== null) {
        out.push({ idx: Number(m[1]), startMs, durS });
      }
      startMs = null;
      durS = null;
    }
  }
  return out;
}

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

  const endOffset = Math.max(0, (recordingEndMs - recordingStartMs) / 1000);
  // pause/resume are exclusions handled by the caller, never boundaries
  const ordered = markers
    .filter((m) => !PAUSE_KINDS.has(m.kind))
    .sort((a, b) => effective(a) - effective(b));

  // boundary points in seconds-from-start, each carrying the label of the
  // segment that begins there (broadcast_end carries null). Every boundary
  // is hard-clamped into [0, endOffset] so an adjustment past either edge
  // can never emit a phantom segment or an out-of-range ffmpeg -to.
  type Boundary = { at: number; label: string | null };
  const boundaries: Boundary[] = ordered.map((m) => ({
    at: Math.min(endOffset, Math.max(0, (effective(m) - recordingStartMs) / 1000)),
    label: SEGMENT_LABEL[m.kind as MarkerKind] ?? m.label,
  }));

  // ensure an opening boundary at 0 and a closing boundary at end, then
  // re-sort by position so the close always sorts last and any clamped
  // boundary lands where its time actually places it
  if (boundaries.length === 0 || boundaries[0].at > 0.5) {
    boundaries.unshift({ at: 0, label: "Pre-game show" });
  }
  boundaries.push({ at: endOffset, label: null });
  // stable sort by position; a labeled boundary tying the close keeps its
  // place before it (close has label null and is pushed last among ties)
  boundaries.sort((a, b) => a.at - b.at);

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
