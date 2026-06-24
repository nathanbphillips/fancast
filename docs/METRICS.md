# Listener metrics — founder query pack

Listening sessions are recorded in `public.listener_segments` (Phase 9, FR-9.4):
one row per audio-listening session, written by `/api/listen` (service role).
Columns: `room_id`, `user_id` (null = anonymous), `mode` (`live` | `radio`),
`started_at`, `last_seen_at` (heartbeat), `ended_at` (null while listening).

**Fastest path:** `npm run metrics` — sweeps stale open sessions and prints
per-room + overall numbers. The queries below are for the Supabase SQL editor
when you want to slice the data yourself.

> Run the stale-sweep first so open-but-abandoned sessions don't inflate
> durations (a tab-close that the unload beacon missed):
> ```sql
> update public.listener_segments
> set ended_at = last_seen_at
> where ended_at is null and last_seen_at < now() - interval '90 seconds';
> ```
> (`npm run metrics` does this for you.)

In the queries below, `coalesce(ended_at, now())` treats a still-live session as
ending "now."

## Per-room summary
```sql
select
  r.id as room_id,
  f.home_team || ' v ' || f.away_team as fixture,
  f.kickoff_utc::date as date,
  count(*) as sessions,
  count(*) filter (where ls.mode = 'radio') as radio_sessions,
  count(distinct ls.user_id) as unique_signed_in,
  count(*) filter (where ls.user_id is null) as anon_sessions,
  round(sum(extract(epoch from (coalesce(ls.ended_at, now()) - ls.started_at))) / 3600.0, 2) as listen_hours,
  round(avg(extract(epoch from (coalesce(ls.ended_at, now()) - ls.started_at))) / 60.0, 1) as avg_session_min
from public.listener_segments ls
join public.rooms r on r.id = ls.room_id
left join public.fixtures f on f.id = r.fixture_id
group by r.id, fixture, date
order by date desc nulls last;
```

## Total listen-hours + unique listeners (all time)
```sql
select
  count(*) as sessions,
  count(distinct user_id) as unique_signed_in_listeners,
  round(sum(extract(epoch from (coalesce(ended_at, now()) - started_at))) / 3600.0, 2) as total_listen_hours
from public.listener_segments;
```

## Peak concurrent listeners for one room
A sweep-line over session start/end events (`+1` on start, `-1` on end):
```sql
with ev as (
  select started_at as t, 1 as d from public.listener_segments where room_id = '<ROOM_ID>'
  union all
  select coalesce(ended_at, now()) as t, -1 as d from public.listener_segments where room_id = '<ROOM_ID>'
)
select max(running) as peak_concurrent
from (select sum(d) over (order by t, d desc) as running from ev) s;
```

## Retention buckets (how long people stayed)
```sql
select
  case
    when secs < 60 then 'under 1 min'
    when secs < 300 then '1-5 min'
    when secs < 900 then '5-15 min'
    when secs < 2700 then '15-45 min'
    else '45+ min'
  end as bucket,
  count(*) as sessions
from (
  select extract(epoch from (coalesce(ended_at, now()) - started_at)) as secs
  from public.listener_segments
) s
group by bucket
order by min(secs);
```
