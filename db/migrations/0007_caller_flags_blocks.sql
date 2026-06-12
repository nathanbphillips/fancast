-- Founder decision 2026-06-11: ending a call is neutral. Three distinct
-- intents replace the PRD's "never removed from air" gate (FR-4.4):
--   1. end call        -> speaker_events 'call_ended' (no consequences)
--   2. flag caller     -> caller_flags (informational, commentator-only)
--   3. block call-ins  -> call_in_blocks (explicit, reversible gate)

alter table public.speaker_events
  drop constraint speaker_events_action_check;
alter table public.speaker_events
  add constraint speaker_events_action_check
  check (action in ('elevated', 'left_air', 'removed', 'call_ended'));

-- ------------------------------------------------------------ caller_flags
-- Private notes between commentators about problematic callers. Never
-- visible to listeners; no effect on the flagged account.
create table public.caller_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  flagged_by uuid not null references public.profiles(user_id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index caller_flags_user_idx on public.caller_flags (user_id, created_at desc);

alter table public.caller_flags enable row level security;

create policy "caller flags readable by commentators and admins"
  on public.caller_flags for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role in ('commentator', 'admin')
    )
  );

-- --------------------------------------------------------- call_in_blocks
-- Deliberate, reversible bar on submitting talk requests. Nothing else
-- about the account is affected.
create table public.call_in_blocks (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  blocked_by uuid not null references public.profiles(user_id),
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);

alter table public.call_in_blocks enable row level security;

create policy "call-in blocks readable by commentators and admins"
  on public.call_in_blocks for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role in ('commentator', 'admin')
    )
  );
