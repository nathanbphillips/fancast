-- Recording pause/resume markers (founder 2026-08-22). A host can pause the
-- RECORDING without pausing the broadcast: live audio and radio carry on,
-- and processing leaves the paused span out of every produced file. Two new
-- marker kinds; the span between a pause and the next resume is excluded.
alter table public.broadcast_markers
  drop constraint if exists broadcast_markers_kind_check;

alter table public.broadcast_markers
  add constraint broadcast_markers_kind_check check (kind in (
    'broadcast_start', 'start_1h', 'stop_1h', 'start_2h', 'stop_2h',
    'start_et', 'stop_et', 'broadcast_end', 'manual',
    'record_pause', 'record_resume'
  ));
