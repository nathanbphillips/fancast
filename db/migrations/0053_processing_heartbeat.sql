-- Liveness heartbeat for processing runs (founder 2026-09-09: "retry after a
-- minute, not ten"). A run killed by the platform writes nothing, so age of
-- the CLAIM was the only death signal and a safe reclaim had to wait out the
-- longest legitimate run (~5 min) plus margin. The processor now proves it is
-- alive every ~15s; silence past ~90s means dead, so retries start in about a
-- minute and a half while a healthy run can never be hijacked.
alter table public.recordings
  add column if not exists processing_heartbeat_at timestamptz;
