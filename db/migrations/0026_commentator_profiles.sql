-- Commentator Platform Epic, PRD-01 (FR-18): self-serve commentator accounts,
-- unified profiles, root-level /{username} URLs.

-- ------------------------------------------------------------- profiles
-- about + social links are commentator-facing profile sections (FR-18.5);
-- terms acceptance is recorded at self-serve upgrade time (FR-18.1).
alter table public.profiles
  add column about text check (char_length(about) <= 280),
  add column social_links jsonb,
  add column commentator_terms_accepted_at timestamptz,
  add column commentator_terms_version text;

-- -------------------------------------------------------- profile_reports
-- User reports against a profile (FR-18.6). Land in the admin/moderation
-- surface; consistent with the other moderation tables: NO client SELECT
-- policy at all (admin reads via the service role only).
create table public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references public.profiles(user_id) on delete cascade,
  reporter_id uuid not null references public.profiles(user_id) on delete cascade,
  reason text not null check (
    reason in ('impersonation', 'abuse', 'spam', 'inappropriate_content', 'other')
  ),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(user_id)
);

create index profile_reports_open_idx
  on public.profile_reports (created_at desc)
  where resolved_at is null;
create index profile_reports_profile_idx
  on public.profile_reports (profile_user_id, created_at desc);

alter table public.profile_reports enable row level security;
-- no SELECT policy on purpose: reports are admin-eyes-only via service role

-- ------------------------------------- reserved-username collision assertion
-- Root /{username} routing (FR-18.3) requires that no existing username is a
-- reserved top-level name. The authoritative list lives in
-- lib/reserved-usernames.ts (enforced in the username zod schema); this
-- point-in-time assertion mirrors it and fails the migration on collision so
-- the route flip can never shadow a real page. Names outside the username
-- pattern (^[A-Za-z0-9_]{3,20}$) cannot collide and are omitted.
do $$
declare
  colliding text;
begin
  select string_agg(username::text, ', ') into colliding
  from public.profiles
  where lower(username::text) in (
    'about','admin','api','auth','guidelines','matches','privacy','room',
    'rooms','settings','signin','terms','welcome',
    'pricing','blog','help','support','login','logout','signup','signout',
    'careers','contact','docs','faq','legal','press','search','explore',
    'discover','live','home','app','download','downloads','notifications',
    'friends','followers','following','profile','profiles','account',
    'accounts','billing','tips','tip','replay','replays','recordings',
    'recording','clubs','teams','fixtures','fixture','community','mod',
    'moderation','status','news','store','shop','dashboard','host','hosts',
    'listen','schedule',
    'manifest','icons','icon','robots','sitemap','favicon','assets','static',
    'public','_next',
    'www','mail','email','ftp','root','null','undefined','administrator',
    'sysadmin','webmaster','postmaster','noreply','security','abuse',
    'official','staff','team','fancast'
  );
  if colliding is not null then
    raise exception
      'reserved-username collision: %. Rename these accounts before applying 0026.',
      colliding;
  end if;
end $$;
