-- Commentator Platform Epic, PRD-02 (FR-19): room slugs, creation inputs,
-- cancel state, and the room_hosts schema (equal co-hosts land in PRD-08;
-- this migration means co-hosting never needs another one).

-- ------------------------------------------------------------------ rooms
alter table public.rooms
  add column slug text,
  add column blurb text check (char_length(blurb) <= 140),
  add column postponed boolean not null default false;

-- cancel becomes a real state (FR-19.7; PRD-01's suspend used DELETE as a
-- stopgap and switches to this)
alter table public.rooms drop constraint rooms_state_check;
alter table public.rooms add constraint rooms_state_check
  check (state in ('scheduled', 'waiting', 'pregame', 'live_1h', 'halftime',
                   'live_2h', 'extra_time', 'postgame', 'wrapped', 'canceled'));

-- backfill slugs for existing rooms: slugify("{home} vs {away} {dd-mon-yyyy}
-- {creator}") with the matchday in Europe/London (FR-19.3), then dedupe with
-- -2/-3 suffixes on the freak collision. Mirrors lib/slug.ts.
with base as (
  select
    r.id,
    trim(both '-' from regexp_replace(
      lower(
        f.home_team || ' vs ' || f.away_team || ' ' ||
        to_char(r.scheduled_kickoff at time zone 'Europe/London', 'DD-Mon-YYYY') ||
        ' ' || p.username::text
      ),
      '[^a-z0-9]+', '-', 'g'
    )) as slug_base
  from public.rooms r
  join public.fixtures f on f.id = r.fixture_id
  join public.profiles p on p.user_id = r.commentator_id
),
deduped as (
  select
    id,
    slug_base ||
      case when row_number() over (partition by slug_base order by id) = 1
        then ''
        else '-' || row_number() over (partition by slug_base order by id)::text
      end as slug
  from base
)
update public.rooms r
set slug = d.slug
from deduped d
where r.id = d.id;

alter table public.rooms alter column slug set not null;
create unique index rooms_slug_key on public.rooms (slug);

-- ------------------------------------------------------------- room_hosts
-- Equal hosts, no primary (founder decision 2026-07-03). Creator-of-record
-- stays on rooms.commentator_id for back-compat; permission checks move to
-- isRoomHost() reading this table. Cap (2 accepted in v1) is enforced in the
-- API, not the schema: the schema supports N.
create table public.room_hosts (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'accepted'
    check (status in ('invited', 'accepted', 'declined', 'left')),
  invited_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (room_id, user_id)
);

create index room_hosts_user_idx on public.room_hosts (user_id, status);

-- every existing room's creator is its accepted host
insert into public.room_hosts (room_id, user_id, status, responded_at)
select id, commentator_id, 'accepted', now()
from public.rooms;

alter table public.room_hosts enable row level security;

-- hosts are public information (they render on cards and room headers)
create policy "room hosts readable by everyone"
  on public.room_hosts for select
  using (true);
