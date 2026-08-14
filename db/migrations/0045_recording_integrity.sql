-- Recording integrity (2026-08-14).
--
-- The Betis show recorded 11 minutes of a 156-minute broadcast and reported
-- status 'ready' with duration_seconds 9384, because duration_seconds is the
-- span between the first and last broadcast marker, not a measurement of the
-- audio. The host was handed a file the system described as 2h36m and which
-- actually contained 100 seconds of speech followed by digital silence, and
-- nothing anywhere said otherwise until it was played.
--
-- So: measure the file, store what was measured, and give the row a state that
-- cannot be mistaken for success.
--
--   audio_seconds    length of full.mp3 as ffmpeg reports it
--   audible_seconds  of that, how much is not silence
--   duration_seconds unchanged: still the marker span, i.e. what SHOULD be there
--
-- 'damaged' means the files exist and are downloadable but do not plausibly
-- represent the broadcast. It is deliberately distinct from 'failed' (nothing
-- produced) and from 'empty' (nothing was ever captured).
alter table public.recordings
  add column if not exists audio_seconds numeric,
  add column if not exists audible_seconds numeric;

alter table public.recordings
  drop constraint if exists recordings_status_check;

alter table public.recordings
  add constraint recordings_status_check
  check (status in ('recording', 'processing', 'ready', 'failed', 'empty', 'damaged'));

comment on column public.recordings.audio_seconds is
  'Measured length of full.mp3. Compare against duration_seconds (the marker span) to detect a truncated capture.';
comment on column public.recordings.audible_seconds is
  'Measured non-silent seconds within full.mp3. A full-length but silent recording is as broken as a short one.';
