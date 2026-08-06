-- Workspace overview stats — see app/workspaces/_lib/actions.ts
-- (getWorkspaceStats, getWorkspaceSessionSummaries) and the overview page at
-- app/workspaces/[id]/overview.
--
-- Both RPCs below are admin-gated (is_workspace_admin, 003_workspaces.sql):
-- turnout/vote-count figures aggregate across every session in the
-- workspace, including invited_list sessions a regular member has no grant
-- for and wouldn't otherwise be able to see even exists. Surfacing
-- participation counts for those to a non-admin would leak information the
-- session's own access rules deny them, so this is deliberately narrower
-- than "any active member" despite the rest of the workspace dashboard
-- being member-visible.
--
-- "Trend vs previous period" (design decision, not specified anywhere
-- upstream): a rolling 30-day window compared against the preceding
-- 30-day window, both measured from now(). Trend figures are pre-computed
-- deltas (current period minus previous period), not raw previous-period
-- values — the frontend renders them directly, no further math needed.
-- Each trend is null (not a delta against zero) whenever the previous
-- period has no data of its own — a brand-new workspace's first sessions
-- would otherwise read as "+N" growth against a baseline that never
-- existed; the frontend hides the trend indicator entirely in that case.
-- Turnout is only computable for all_members (workspace member count) and
-- invited_list (grant count) sessions — public_link's eligible pool is
-- unbounded, so those sessions are excluded from every turnout figure
-- (overall and both trend periods) rather than skewing the average with a
-- meaningless denominator.

create or replace function public.get_workspace_stats(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_current_start timestamptz := now() - interval '30 days';
  v_previous_start timestamptz := now() - interval '60 days';
  v_member_count int;
  v_result jsonb;
begin
  if not public.is_workspace_admin(p_workspace_id) then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;

  select count(*) into v_member_count
  from public.workspace_memberships
  where workspace_id = p_workspace_id and status = 'active';

  with sessions as (
    select
      vs.id,
      vs.status,
      vs.created_at,
      (select count(*) from public.votes v where v.session_id = vs.id) as vote_count,
      case
        when vs.who_can_vote = 'all_members' then v_member_count
        when vs.who_can_vote = 'invited_list' then
          (select count(*)::int from public.session_access_grants g where g.session_id = vs.id)
        else null
      end as eligible_count
    from public.voting_sessions vs
    where vs.workspace_id = p_workspace_id
  ),
  turnout as (
    select
      id,
      created_at,
      case when eligible_count is not null and eligible_count > 0
        then (vote_count::numeric / eligible_count) * 100
      end as turnout_pct
    from sessions
  ),
  current_sessions as (
    select count(*) as n from sessions where created_at >= v_current_start
  ),
  previous_sessions as (
    select count(*) as n from sessions where created_at >= v_previous_start and created_at < v_current_start
  ),
  current_votes as (
    select count(*) as n
    from public.votes v
    join public.voting_sessions vs on vs.id = v.session_id
    where vs.workspace_id = p_workspace_id and v.created_at >= v_current_start
  ),
  previous_votes as (
    select count(*) as n
    from public.votes v
    join public.voting_sessions vs on vs.id = v.session_id
    where vs.workspace_id = p_workspace_id
      and v.created_at >= v_previous_start and v.created_at < v_current_start
  ),
  current_turnout as (
    select avg(turnout_pct) as avg_pct, count(*) as n
    from turnout
    where turnout_pct is not null and created_at >= v_current_start
  ),
  previous_turnout as (
    select avg(turnout_pct) as avg_pct, count(*) as n
    from turnout
    where turnout_pct is not null and created_at >= v_previous_start and created_at < v_current_start
  )
  select jsonb_build_object(
    'success', true,
    'stats', jsonb_build_object(
      'totalSessions', (select count(*) from sessions),
      'totalVotes', (select coalesce(sum(vote_count), 0) from sessions),
      'averageTurnout', (select avg(turnout_pct) from turnout where turnout_pct is not null),
      'activeSessions', (select count(*) from sessions where status = 'open'),
      'trends', jsonb_build_object(
        -- null (not a delta against zero) whenever the previous period has
        -- no data of its own to compare against — a brand-new workspace's
        -- first sessions/votes would otherwise read as "+N" growth, which
        -- overstates a baseline that never existed.
        'totalSessions', case
          when (select n from previous_sessions) > 0
            then (select n from current_sessions) - (select n from previous_sessions)
          else null
        end,
        'totalVotes', case
          when (select n from previous_votes) > 0
            then (select n from current_votes) - (select n from previous_votes)
          else null
        end,
        'averageTurnout', case
          when (select n from current_turnout) > 0 and (select n from previous_turnout) > 0
            then (select avg_pct from current_turnout) - (select avg_pct from previous_turnout)
          else null
        end
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Per-session grid data for the overview page — same eligible-pool/turnout
-- logic as get_workspace_stats above, but one row per session instead of a
-- workspace-wide aggregate. lastActivity is the most recent vote's
-- timestamp, falling back to the session's created_at when it has none yet
-- (there's no dedicated "last activity" column to read instead).
create or replace function public.get_workspace_session_summaries(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_member_count int;
  v_result jsonb;
begin
  if not public.is_workspace_admin(p_workspace_id) then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;

  select count(*) into v_member_count
  from public.workspace_memberships
  where workspace_id = p_workspace_id and status = 'active';

  select jsonb_build_object(
    'success', true,
    'sessions', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', vs.id,
          'title', vs.title,
          'description', vs.description,
          'status', vs.status,
          'createdAt', vs.created_at,
          'lastActivity', coalesce(vote_stats.last_vote_at, vs.created_at),
          'voteCount', coalesce(vote_stats.vote_count, 0),
          'turnoutPct', case
            when eligible.eligible_count is not null and eligible.eligible_count > 0
              then round((coalesce(vote_stats.vote_count, 0)::numeric / eligible.eligible_count) * 100, 1)
            else null
          end
        )
        order by vs.created_at desc
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.voting_sessions vs
  left join lateral (
    select count(*) as vote_count, max(created_at) as last_vote_at
    from public.votes v
    where v.session_id = vs.id
  ) vote_stats on true
  left join lateral (
    select case
      when vs.who_can_vote = 'all_members' then v_member_count
      when vs.who_can_vote = 'invited_list' then
        (select count(*)::int from public.session_access_grants g where g.session_id = vs.id)
      else null
    end as eligible_count
  ) eligible on true
  where vs.workspace_id = p_workspace_id;

  return v_result;
end;
$$;
