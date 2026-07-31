-- Per demos-system-design.md § 8.4: VotingSession.results_style lets an
-- admin override the default chart chosen for a session's results
-- (single -> pie, multiple -> horizontal bar, ranked -> leaderboard). Null
-- means "use the vote_format default" — most sessions never set this.
alter table public.voting_sessions
  add column results_style text check (results_style in ('pie_chart', 'bar_chart', 'leaderboard'));
