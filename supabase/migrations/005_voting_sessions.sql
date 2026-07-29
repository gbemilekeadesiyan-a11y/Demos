-- Voting Session lifecycle & vote casting/tallying module.
-- See demos-system-design.md § 3, § 8.3.
--
-- Note: 004 was already taken by 004_auth_email_lookup.sql, so this one
-- picks up at 005 to keep the sequential migration order intact.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.voting_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  description text,
  vote_format text not null check (vote_format in ('single', 'multiple', 'ranked')),
  visibility text not null check (visibility in ('public', 'private')),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'results_released')),
  who_can_vote text not null check (who_can_vote in ('all_members', 'invited_list', 'public_link')),
  allow_anonymous_vote boolean not null default false,
  results_visibility text not null check (results_visibility in ('hidden_until_close', 'live', 'after_you_vote')),
  start_time timestamptz,
  end_time timestamptz,
  -- not in the § 3 entity table, but app/sessions/_lib/actions.ts's
  -- listSessions(workspaceId, { createdByMe }) needs a creator to filter by.
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on column public.voting_sessions.visibility is
  'Descriptive metadata only — not enforced as an access gate. Access is controlled entirely by who_can_vote; see can_access_session() below.';

create index voting_sessions_workspace_id_idx on public.voting_sessions (workspace_id);

create table public.session_options (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voting_sessions (id) on delete cascade,
  label text not null,
  description text,
  image_url text,
  -- Option order is otherwise non-deterministic, which breaks ranked-choice
  -- ballots and the drag-to-reorder UI. Callers must ORDER BY this — adding
  -- that to getSessionDetails's query is a follow-up, not part of this
  -- migration (see app/sessions/_lib/actions.ts).
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index session_options_session_id_idx on public.session_options (session_id);
create index session_options_session_id_display_order_idx on public.session_options (session_id, display_order);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voting_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index votes_session_id_idx on public.votes (session_id);

-- session_id is denormalized from votes.session_id (kept in sync by
-- cast_vote() below) so RLS/queries here don't need to join through votes.
create table public.vote_selections (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.votes (id) on delete cascade,
  session_id uuid not null references public.voting_sessions (id) on delete cascade,
  option_id uuid not null references public.session_options (id) on delete cascade,
  rank integer,
  created_at timestamptz not null default now(),
  unique (vote_id, option_id)
);

create index vote_selections_session_id_idx on public.vote_selections (session_id);
create index vote_selections_vote_id_idx on public.vote_selections (vote_id);

-- One rank per ballot — a vote can't rank two options identically.
create unique index vote_selections_vote_rank_uidx
  on public.vote_selections (vote_id, rank)
  where rank is not null;

create table public.session_access_grants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voting_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index session_access_grants_session_id_idx on public.session_access_grants (session_id);

-- ---------------------------------------------------------------------------
-- RLS helpers
--
-- security definer, same pattern as is_active_workspace_member /
-- is_workspace_admin in 003_workspaces.sql: these need to read rows the
-- calling user isn't necessarily allowed to see directly (that's the
-- decision they exist to make), so they run with elevated privilege and
-- decide access explicitly instead of relying on the caller's own RLS view.
-- ---------------------------------------------------------------------------

-- Who can view/vote in a session, per § 8.3: workspace admins always can;
-- otherwise it's driven by who_can_vote (public_link = anyone,
-- all_members = active workspace membership, invited_list =
-- session_access_grants). `visibility` (public/private) is treated as
-- descriptive metadata, not a separate access gate — § 8.3 ties access
-- entirely to who_can_vote and doesn't define a distinct rule for
-- visibility, so enforcing both would be guessing at an unstated rule.
create function public.can_access_session(target_session_id uuid)
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

  if v_session.who_can_vote = 'public_link' then
    -- public_link allows anyone, but an anonymous caller only when the
    -- session opted into it — see demos-system-design.md § 8.3. Same
    -- is_anonymous check Supabase's own JWT carries, used the same way
    -- new.is_anonymous is checked in handle_new_user() (002_profiles.sql).
    if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) and not v_session.allow_anonymous_vote then
      return false;
    end if;
    return true;
  end if;

  if v_session.who_can_vote = 'all_members' then
    return public.is_active_workspace_member(v_session.workspace_id);
  end if;

  -- invited_list
  return exists (
    select 1 from public.session_access_grants
    where session_id = target_session_id and user_id = auth.uid()
  );
end;
$$;

-- Whether the caller can read Vote/VoteSelection rows for a session, per
-- the results_visibility modes in § 8.3 (hidden_until_close, live) plus
-- after_you_vote (readable once the caller has cast a Vote in this
-- session). Admins always can; base session access is still required.
create function public.can_view_session_results(target_session_id uuid)
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

  if not public.can_access_session(target_session_id) then
    return false;
  end if;

  if v_session.results_visibility = 'live' then
    return true;
  end if;

  if v_session.results_visibility = 'hidden_until_close' then
    return v_session.status = 'results_released';
  end if;

  -- after_you_vote
  return exists (
    select 1 from public.votes
    where session_id = target_session_id and user_id = auth.uid()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: voting_sessions
-- ---------------------------------------------------------------------------

alter table public.voting_sessions enable row level security;

create policy "Sessions are visible per who_can_vote / admin"
  on public.voting_sessions for select
  using (public.can_access_session(id));

create policy "Admins can create sessions in their workspace"
  on public.voting_sessions for insert
  with check (public.is_workspace_admin(workspace_id) and created_by = auth.uid());

create policy "Admins can update sessions in their workspace"
  on public.voting_sessions for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- RLS: session_options
-- ---------------------------------------------------------------------------

alter table public.session_options enable row level security;

create policy "Session options are visible to whoever can access the session"
  on public.session_options for select
  using (public.can_access_session(session_id));

create policy "Admins can add options to their sessions"
  on public.session_options for insert
  with check (
    public.is_workspace_admin((select workspace_id from public.voting_sessions where id = session_id))
  );

create policy "Admins can update options in their sessions"
  on public.session_options for update
  using (
    public.is_workspace_admin((select workspace_id from public.voting_sessions where id = session_id))
  );

create policy "Admins can delete options from their sessions"
  on public.session_options for delete
  using (
    public.is_workspace_admin((select workspace_id from public.voting_sessions where id = session_id))
  );

-- ---------------------------------------------------------------------------
-- RLS: votes
--
-- Inserts normally go through cast_vote() below (atomic with
-- vote_selections and with ballot-shape validation a bare insert can't
-- express); this insert policy is defense in depth, not the primary write
-- path.
-- ---------------------------------------------------------------------------

alter table public.votes enable row level security;

create policy "Voters can see their own vote, results-eligible users see all"
  on public.votes for select
  using (user_id = auth.uid() or public.can_view_session_results(session_id));

create policy "Eligible users can cast their own vote while a session is open"
  on public.votes for insert
  with check (
    user_id = auth.uid()
    and public.can_access_session(session_id)
    and exists (
      select 1 from public.voting_sessions vs
      where vs.id = session_id and vs.status = 'open'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: vote_selections
-- ---------------------------------------------------------------------------

alter table public.vote_selections enable row level security;

create policy "Voters can see their own selections, results-eligible users see all"
  on public.vote_selections for select
  using (
    exists (select 1 from public.votes v where v.id = vote_id and v.user_id = auth.uid())
    or public.can_view_session_results(session_id)
  );

create policy "Voters can add selections to their own open-session vote"
  on public.vote_selections for insert
  with check (
    exists (
      select 1 from public.votes v
      join public.voting_sessions vs on vs.id = v.session_id
      where v.id = vote_id
        and v.session_id = vote_selections.session_id
        and v.user_id = auth.uid()
        and vs.status = 'open'
    )
    and exists (
      select 1 from public.session_options so
      where so.id = option_id and so.session_id = vote_selections.session_id
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: session_access_grants
-- ---------------------------------------------------------------------------

alter table public.session_access_grants enable row level security;

create policy "Grantees and admins can view session access grants"
  on public.session_access_grants for select
  using (
    user_id = auth.uid()
    or public.is_workspace_admin((select workspace_id from public.voting_sessions where id = session_id))
  );

create policy "Admins can grant session access"
  on public.session_access_grants for insert
  with check (
    public.is_workspace_admin((select workspace_id from public.voting_sessions where id = session_id))
  );

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Wraps "validate ballot shape + insert vote envelope + insert selections"
-- in one transaction so a rejected selection can't leave an orphaned vote
-- row with no choices attached (a plain multi-step client insert would need
-- a separate delete policy just to clean that up after a partial failure).
create function public.cast_vote(p_session_id uuid, p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.voting_sessions%rowtype;
  v_vote_id uuid;
  v_selection jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  if p_selections is null or jsonb_array_length(p_selections) = 0 then
    return jsonb_build_object('success', false, 'error', 'Select at least one option');
  end if;

  select * into v_session from public.voting_sessions where id = p_session_id;

  if not found or v_session.status <> 'open' then
    return jsonb_build_object('success', false, 'error', 'This session is not open for voting');
  end if;

  if not public.can_access_session(p_session_id) then
    return jsonb_build_object('success', false, 'error', 'Not eligible to vote in this session');
  end if;

  if v_session.vote_format = 'single' and jsonb_array_length(p_selections) <> 1 then
    return jsonb_build_object('success', false, 'error', 'Select exactly one option');
  end if;

  if v_session.vote_format = 'multiple' and jsonb_array_length(p_selections) < 1 then
    return jsonb_build_object('success', false, 'error', 'Select at least one option');
  end if;

  if v_session.vote_format in ('single', 'multiple') and exists (
    select 1 from jsonb_array_elements(p_selections) as sel
    where sel ->> 'rank' is not null
  ) then
    return jsonb_build_object('success', false, 'error', 'Rank is not allowed for this vote format');
  end if;

  if v_session.vote_format = 'ranked' and exists (
    select 1 from jsonb_array_elements(p_selections) as sel
    where sel ->> 'rank' is null
  ) then
    return jsonb_build_object('success', false, 'error', 'Every option must be ranked');
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_selections) as sel
    where not exists (
      select 1 from public.session_options so
      where so.id = (sel ->> 'optionId')::uuid and so.session_id = p_session_id
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'Invalid option selected');
  end if;

  begin
    insert into public.votes (session_id, user_id)
    values (p_session_id, auth.uid())
    returning id into v_vote_id;
  exception
    when unique_violation then
      return jsonb_build_object('success', false, 'error', 'You have already voted in this session');
  end;

  for v_selection in select * from jsonb_array_elements(p_selections)
  loop
    insert into public.vote_selections (vote_id, session_id, option_id, rank)
    values (
      v_vote_id,
      p_session_id,
      (v_selection ->> 'optionId')::uuid,
      case when v_selection ->> 'rank' is null then null else (v_selection ->> 'rank')::int end
    );
  end loop;

  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Duplicate option or rank in your selections');
end;
$$;
