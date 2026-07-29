-- Total vote count for a session, independent of results_visibility.
-- getSessionResults (app/sessions/_lib/actions.ts) needs an accurate
-- totalVotes even when the per-option breakdown is locked (e.g. "45 votes
-- · Vote to see results"), but the "votes" RLS policy
-- ("Voters can see their own vote, results-eligible users see all", in
-- 005_voting_sessions.sql) means a plain count from a non-eligible caller's
-- own session only reflects their own vote, not the true total. This
-- mirrors can_access_session/can_view_session_results' security-definer
-- pattern to return just a count, never row contents, so it doesn't widen
-- what's actually exposed.
create function public.count_session_votes(target_session_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.can_access_session(target_session_id) then
    return 0;
  end if;

  return (select count(*)::integer from public.votes where session_id = target_session_id);
end;
$$;
