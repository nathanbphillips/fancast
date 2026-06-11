-- Phase 4: questions, talk requests, preference slider.
-- questions/talk_requests are private: readable only by the author, the
-- room's commentator, and admins (ARCHITECTURE RLS notes). Writes go
-- through API routes with the service role, as everywhere.

-- -------------------------------------------------------------- questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  status text not null default 'new'
    check (status in ('new', 'acknowledged', 'dismissed')),
  created_at timestamptz not null default now()
);

create index questions_room_idx on public.questions (room_id, created_at desc);

alter table public.questions enable row level security;

create policy "questions readable by author, room commentator, admin"
  on public.questions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.commentator_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------- talk_requests
create table public.talk_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 120),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed', 'completed')),
  -- broadcast/recording consent (Terms §5); first request requires the
  -- checkbox, later ones inherit the earliest consent timestamp
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index talk_requests_room_idx on public.talk_requests (room_id, status);

alter table public.talk_requests enable row level security;

create policy "talk requests readable by author, room commentator, admin"
  on public.talk_requests for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.commentator_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

-- ----------------------------------------------------------- slider_votes
create table public.slider_votes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  value integer not null check (value between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.slider_votes enable row level security;

-- individual positions stay private; the public aggregate is computed
-- server-side and published on the control channel
create policy "slider votes readable by owner"
  on public.slider_votes for select
  using (user_id = auth.uid());
