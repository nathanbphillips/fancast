-- Dev seed: placeholder Arsenal fixtures until the API-Football key arrives.
-- Negative ids mark them as seeds; the first real sync deletes id < 0.
insert into public.fixtures
  (id, competition, round, home_team, away_team, home_team_id, away_team_id, kickoff_utc, status)
values
  (-1, 'Premier League', 'Matchweek 1', 'Arsenal', 'Chelsea', 42, 49, '2026-08-15 16:30:00+00', 'NS'),
  (-2, 'Premier League', 'Matchweek 2', 'Newcastle', 'Arsenal', 34, 42, '2026-08-22 14:00:00+00', 'NS'),
  (-3, 'Premier League', 'Matchweek 3', 'Arsenal', 'Manchester United', 42, 33, '2026-08-29 16:30:00+00', 'NS'),
  (-4, 'Premier League', 'Matchweek 4', 'Brighton', 'Arsenal', 51, 42, '2026-09-12 14:00:00+00', 'NS');
