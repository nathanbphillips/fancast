-- Phase 8 hardening: a claim timestamp so processRecording can atomically
-- claim a recording (preventing concurrent runs from racing on segment
-- rows) and so a crashed/timed-out run becomes reclaimable after a stale
-- window instead of being pinned at 'processing' forever.
alter table public.recordings
  add column processing_started_at timestamptz;
