-- Per-session ballot secrecy. See demos-system-design.md § 8.3/8.4 context
-- on results_visibility, which this is independent of: results_visibility
-- controls *when* aggregate results are visible; ballot_secrecy controls
-- whether a viewer who's allowed to see results can also see *who chose
-- what*, as opposed to just aggregate counts and who participated.
--
-- The hole this closes: the pre-existing "vote_selections" SELECT policy
-- ("Voters can see their own selections, results-eligible users see all")
-- let any results-eligible caller read every vote_selections row for a
-- session, including vote_id. The "votes" policy separately exposes
-- user_id for the same audience ("results-eligible users see all"). Since
-- vote_id -> votes.id -> votes.user_id, any results-eligible non-admin
-- could join the two directly (via two ordinary authenticated requests,
-- not even a clever query) and reconstruct exactly who voted for what —
-- regardless of results_visibility settings. That's real ballot secrecy
-- being purely cosmetic today.

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------

alter table public.voting_sessions
  add column ballot_secrecy text not null default 'secret' check (ballot_secrecy in ('secret', 'open'));

comment on column public.voting_sessions.ballot_secrecy is
  'secret: non-admins can see aggregate counts and who participated, never who chose what. open: linkage is visible to anyone eligible to view results, same as before this column existed. Defaulted by workspace type at creation (secret for standard, open for ff) in createVotingSession — see app/sessions/_lib/actions.ts — admins can override per session.';

-- Backfill existing rows to what createVotingSession would have chosen had
-- this column existed at insert time, rather than leaving every
-- already-created session on the 'secret' column default regardless of its
-- workspace type.
update public.voting_sessions vs
set ballot_secrecy = 'open'
from public.workspaces w
where w.id = vs.workspace_id and w.type = 'ff';

-- ---------------------------------------------------------------------------
-- RLS helper
-- ---------------------------------------------------------------------------

-- Whether the caller may see the linkage between a specific voter and their
-- selections for this session — as opposed to just aggregate counts or the
-- fact that someone voted. Workspace admins always can (unchanged from
-- today). A voter can always see their own ballot, but that's handled by
-- the vote_selections policy itself (an exists() against their own vote),
-- not here. Everyone else — the case this function actually decides — only
-- when the session opted out of secrecy.
create function public.can_view_ballot_linkage(target_session_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_session public.voting_sessions%rowtype;
begin
  select * into v_session from public.voting_sessions where id = target_session_id;

  if not found then
    return false;
  end if;

  if public.is_workspace_admin(v_session.workspace_id) then
    return true;
  end if;

  if v_session.ballot_secrecy <> 'open' then
    return false;
  end if;

  return public.can_view_session_results(target_session_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: vote_selections — tightened
--
-- "votes" is deliberately untouched: "Voters can see their own vote,
-- results-eligible users see all" already matches the requirement that
-- participation (who voted) stays visible under secrecy — that policy
-- never exposed *what* anyone chose on its own, only vote_selections
-- joined against it did.
-- ---------------------------------------------------------------------------

drop policy "Voters can see their own selections, results-eligible users see all" on public.vote_selections;

create policy "Voters can see their own selections; others only for admins or open-ballot sessions"
  on public.vote_selections for select
  using (
    exists (select 1 from public.votes v where v.id = vote_id and v.user_id = auth.uid())
    or public.can_view_ballot_linkage(session_id)
  );

-- ---------------------------------------------------------------------------
-- Aggregate tallying for secret sessions
--
-- With the policy above, a non-admin caller on a secret session can no
-- longer read raw vote_selections rows at all — including for legitimate
-- aggregate tallying (getSessionResults' vote-counting, unaffected by
-- secrecy). This returns the same option_id/rank shape the client already
-- tallies client-side, but with vote_id replaced by a dense_rank() computed
-- fresh per call: still lets ranked-choice IRV group a ballot's selections
-- together (it needs *some* per-ballot grouping key to redistribute
-- eliminated choices correctly), but that number has no relationship to
-- votes.id and can't be joined back to votes.user_id.
create function public.get_session_selections_for_tally(target_session_id uuid)
returns table (ballot_ref bigint, option_id uuid, rank integer)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.can_view_session_results(target_session_id) then
    return;
  end if;

  return query
    select dense_rank() over (order by vs.vote_id), vs.option_id, vs.rank
    from public.vote_selections vs
    where vs.session_id = target_session_id;
end;
$$;
