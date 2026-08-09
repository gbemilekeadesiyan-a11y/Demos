-- Departments — the WorkspaceGroup entity deferred in demos-system-design.md
-- § 3 ("Confirmed needed, deferred to phase 2... same pattern as
-- WorkspaceMembership"). See app/workspaces/_lib/actions.ts (createDepartment,
-- renameDepartment, deleteDepartment, listDepartments, addMemberToDepartment,
-- removeMemberFromDepartment) and app/sessions/_lib/actions.ts
-- (grantSessionAccess).
--
-- Workspaces-only, not F&F — enforced twice below: workspace_groups can't be
-- created under an ff workspace (insert policy), and a session's
-- who_can_vote can't be 'departments' in one either (extends the existing
-- ff-visibility trigger from 011_ff_workspaces.sql).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workspace_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index workspace_groups_workspace_id_idx on public.workspace_groups (workspace_id);

-- References workspace_memberships, not auth.users directly — department
-- membership is scoped to *workspace* membership (same person's membership
-- in a different workspace is a different row), and cascades for free when
-- someone leaves the workspace (workspace_memberships row deleted -> their
-- workspace_group_members rows go with it) rather than needing separate
-- cleanup.
create table public.workspace_group_members (
  group_id uuid not null references public.workspace_groups (id) on delete cascade,
  membership_id uuid not null references public.workspace_memberships (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, membership_id)
);

create index workspace_group_members_membership_id_idx on public.workspace_group_members (membership_id);

-- ---------------------------------------------------------------------------
-- RLS: workspace_groups — visible to active workspace members, managed
-- (create/rename/delete) by admins only. Same permission shape as
-- workspaces/workspace_memberships in 003_workspaces.sql.
-- ---------------------------------------------------------------------------

alter table public.workspace_groups enable row level security;

create policy "Workspace groups are visible to active members"
  on public.workspace_groups for select
  using (public.is_active_workspace_member(workspace_id));

-- Workspaces-only: an ff workspace's type is checked here so group creation
-- fails at the database layer, not just by the UI never offering it.
create policy "Admins can create workspace groups, Workspaces only"
  on public.workspace_groups for insert
  with check (
    public.is_workspace_admin(workspace_id)
    and (select type from public.workspaces where id = workspace_id) <> 'ff'
  );

create policy "Admins can rename workspace groups"
  on public.workspace_groups for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "Admins can delete workspace groups"
  on public.workspace_groups for delete
  using (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- RLS: workspace_group_members — same visible-to-members/managed-by-admins
-- shape, resolved through workspace_groups.workspace_id since this table
-- has no workspace_id column of its own.
-- ---------------------------------------------------------------------------

alter table public.workspace_group_members enable row level security;

create policy "Workspace group membership is visible to active workspace members"
  on public.workspace_group_members for select
  using (
    public.is_active_workspace_member((select workspace_id from public.workspace_groups where id = group_id))
  );

-- Also checks the membership being added belongs to the *same* workspace as
-- the group — RLS already restricts who can call this to admins of the
-- group's own workspace, but nothing else stops them passing a
-- membership_id borrowed from an unrelated workspace without this.
create policy "Admins can add workspace group members"
  on public.workspace_group_members for insert
  with check (
    public.is_workspace_admin((select workspace_id from public.workspace_groups where id = group_id))
    and (select workspace_id from public.workspace_memberships where id = membership_id)
      = (select workspace_id from public.workspace_groups where id = group_id)
  );

create policy "Admins can remove workspace group members"
  on public.workspace_group_members for delete
  using (
    public.is_workspace_admin((select workspace_id from public.workspace_groups where id = group_id))
  );

-- ---------------------------------------------------------------------------
-- session_access_grants: reference a group instead of a user
--
-- user_id becomes nullable, group_id is added (also nullable), and a check
-- constraint requires exactly one of the two — a grant is either "this
-- person" or "this department," never both, never neither. The old
-- unique(session_id, user_id) is replaced with two partial unique indexes
-- rather than a single unique(session_id, user_id, group_id): a plain
-- 3-column unique constraint wouldn't actually stop duplicate group grants,
-- since NULL user_id values are never considered equal to each other under
-- standard uniqueness rules.
-- ---------------------------------------------------------------------------

alter table public.session_access_grants
  alter column user_id drop not null,
  add column group_id uuid references public.workspace_groups (id) on delete cascade,
  add constraint session_access_grants_target_check check ((user_id is not null) <> (group_id is not null));

alter table public.session_access_grants
  drop constraint session_access_grants_session_id_user_id_key;

create unique index session_access_grants_session_user_uidx
  on public.session_access_grants (session_id, user_id) where user_id is not null;

create unique index session_access_grants_session_group_uidx
  on public.session_access_grants (session_id, group_id) where group_id is not null;

-- Re-check the insert policy: a granted group must belong to the same
-- workspace as the session (same reasoning as the group-members insert
-- policy above — is_workspace_admin already scopes *who* can insert, this
-- additionally scopes *what* they can reference).
drop policy "Admins can grant session access" on public.session_access_grants;

create policy "Admins can grant session access"
  on public.session_access_grants for insert
  with check (
    public.is_workspace_admin((select workspace_id from public.voting_sessions where id = session_id))
    and (
      group_id is null
      or (select workspace_id from public.workspace_groups where id = group_id)
        = (select workspace_id from public.voting_sessions where id = session_id)
    )
  );

-- select policy unchanged in substance ("Grantees and admins can view
-- session access grants": user_id = auth.uid() or admin) — a group-grant
-- row has no single "grantee" to match against auth.uid() via user_id, so
-- non-admin group members see it only indirectly, via can_access_session()
-- granting them the session itself, not by reading this table directly.
-- That's an acceptable gap: the same is already true today for
-- 'all_members' sessions, where a member's access comes from
-- is_active_workspace_member() and no session_access_grants row exists for
-- them to read in the first place.

-- ---------------------------------------------------------------------------
-- voting_sessions.who_can_vote: add 'departments'
-- ---------------------------------------------------------------------------

alter table public.voting_sessions
  drop constraint voting_sessions_who_can_vote_check;

alter table public.voting_sessions
  add constraint voting_sessions_who_can_vote_check
  check (who_can_vote in ('all_members', 'invited_list', 'public_link', 'departments'));

-- Workspaces-only, same as workspace_groups' own insert policy above —
-- extends the existing ff-visibility trigger (011_ff_workspaces.sql) rather
-- than adding a second trigger on the same columns.
create or replace function public.enforce_ff_workspace_session_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_type text;
begin
  select type into v_workspace_type from public.workspaces where id = new.workspace_id;

  if v_workspace_type = 'ff'
    and (new.visibility = 'private' or new.who_can_vote in ('invited_list', 'departments'))
  then
    raise exception
      'F&F workspaces have no private mode — sessions must be public and open to all_members or public_link, not private, invited_list, or departments'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- can_access_session: resolve department membership
--
-- 'invited_list' and 'departments' now share one resolution rule — a grant
-- is either a direct user_id match, or a group_id whose
-- workspace_group_members roster includes a workspace_memberships row for
-- the caller. This also means an 'invited_list' session's grants can
-- include department-based rows and vice versa; who_can_vote's two values
-- are about which the create-session UI defaults to offering, not two
-- separate resolution mechanisms.
-- ---------------------------------------------------------------------------

create or replace function public.can_access_session(target_session_id uuid)
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
    if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) and not v_session.allow_anonymous_vote then
      return false;
    end if;
    return true;
  end if;

  if v_session.who_can_vote = 'all_members' then
    return public.is_active_workspace_member(v_session.workspace_id);
  end if;

  -- invited_list / departments
  return exists (
    select 1 from public.session_access_grants g
    where g.session_id = target_session_id
      and (
        g.user_id = auth.uid()
        or (
          g.group_id is not null
          and exists (
            select 1
            from public.workspace_group_members gm
            join public.workspace_memberships wm on wm.id = gm.membership_id
            where gm.group_id = g.group_id
              and wm.user_id = auth.uid()
              and wm.status = 'active'
          )
        )
      )
  );
end;
$$;
