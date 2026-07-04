-- Commentator Platform Epic, PRD-04 (FR-21): the notification platform. Email
-- (Resend) + web push (PWA), per-type preferences, batching, dedupe, signed
-- one-click unsubscribe. Supersedes FR-16.

-- ------------------------------------------------------- push_subscriptions
-- one row per device (browser push endpoint). iOS requires the installed PWA.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id)
  where revoked_at is null;

alter table public.push_subscriptions enable row level security;
-- device tokens are never client-read; the API manages them via service role

-- -------------------------------------------------------- notification_prefs
-- per-user per-type email + push toggles. An absent row = the registry default
-- (lib/notify/types.ts), so we only store deviations.
create table public.notification_prefs (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null,
  email_enabled boolean not null,
  push_enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

alter table public.notification_prefs enable row level security;

-- a user reads only their own prefs (the settings page)
create policy "own notification prefs readable"
  on public.notification_prefs for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------ notifications_outbox
-- every notification is enqueued here first (DB is source of truth). Immediate
-- types send inline after the response; scheduled reminders drain on due_at.
-- dedupe_key (recipient, room, type[, window]) guarantees at-most-one per
-- person per room per type while unsent (FR-21.3).
create table public.notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null,
  channel text not null check (channel in ('email', 'push')),
  room_id uuid references public.rooms(id) on delete cascade,
  actor_id uuid references public.profiles(user_id) on delete set null,
  due_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- at-most-one UNSENT row per dedupe key (FR-21.3). A new event with the same
-- key while one is still pending is a no-op insert (ON CONFLICT DO NOTHING).
create unique index notifications_outbox_dedupe_unsent_idx
  on public.notifications_outbox (dedupe_key)
  where sent_at is null;

-- the drainer pulls due, unsent rows oldest-first
create index notifications_outbox_due_idx
  on public.notifications_outbox (due_at)
  where sent_at is null;

alter table public.notifications_outbox enable row level security;
-- outbox is service-role only; never client-read
