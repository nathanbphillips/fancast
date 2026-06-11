-- Phase 3: chat, votes, weighted flags, links feed, moderation.
-- Same write model as 0001: clients SELECT directly (RLS), all writes go
-- through API routes with the service role. Vote/flag aggregate counters
-- live on the parent rows so initial render needs no aggregation queries;
-- API routes recompute them on every write and publish over Ably.

-- ---------------------------------------------------------- chat_messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  is_waiting_room boolean not null default false,
  -- moderation: null = visible; all hides are logged by these two columns
  hidden_by text check (hidden_by in ('flags', 'commentator', 'admin')),
  hidden_at timestamptz,
  -- aggregates maintained by API routes
  up_count integer not null default 0,
  down_count integer not null default 0,
  flag_weight numeric(4, 1) not null default 0,
  created_at timestamptz not null default now()
);

create index chat_messages_room_idx on public.chat_messages (room_id, created_at);

alter table public.chat_messages enable row level security;

create policy "chat readable by everyone"
  on public.chat_messages for select
  using (true);

-- ---------------------------------------------------------- message_votes
create table public.message_votes (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_votes enable row level security;

create policy "message votes readable by everyone"
  on public.message_votes for select
  using (true);

-- ---------------------------------------------------------- message_flags
create table public.message_flags (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  weight numeric(2, 1) not null check (weight in (0.5, 1.0)),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_flags enable row level security;

-- flags are write-only for listeners; only commentator/admin review them
create policy "flags readable by commentator and admin"
  on public.message_flags for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role in ('commentator', 'admin')
    )
  );

-- ------------------------------------------------------------------ links
create table public.links (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  url text not null,
  og_title text,
  og_description text,
  og_image text,
  domain text not null,
  hidden boolean not null default false,
  up_count integer not null default 0,
  down_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index links_room_idx on public.links (room_id, created_at);

alter table public.links enable row level security;

create policy "links readable by everyone"
  on public.links for select
  using (true);

-- ------------------------------------------------------------- link_votes
create table public.link_votes (
  link_id uuid not null references public.links(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (link_id, user_id)
);

alter table public.link_votes enable row level security;

create policy "link votes readable by everyone"
  on public.link_votes for select
  using (true);

-- ------------------------------------------------------ blocklist_domains
create table public.blocklist_domains (
  domain text primary key,
  reason text,
  added_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now()
);

alter table public.blocklist_domains enable row level security;

create policy "blocklist readable by commentator and admin"
  on public.blocklist_domains for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role in ('commentator', 'admin')
    )
  );

-- ------------------------------------------------------------------- bans
create table public.bans (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  device_hash text,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.bans enable row level security;

create policy "bans readable by admin"
  on public.bans for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );
