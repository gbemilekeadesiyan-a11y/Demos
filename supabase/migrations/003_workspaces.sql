-- Workspace, Membership & Invite module. See demos-system-design.md § 8.2.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'standard' check (type in ('standard', 'ff')),
  created_by uuid not null references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'moderator', 'member')),
  status text not null default 'active' check (status in ('active', 'pending')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_memberships_user_id_idx on public.workspace_memberships (user_id);

-- workspace_id or session_id, per § 8.2 — session_id has no FK yet since the
-- Voting Session module (§ 8.3) hasn't landed; add it when that table exists.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  session_id uuid,
  code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  requires_verification boolean not null default false,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer not null default 0,
  created_at timestamptz not null default now(),
  check ((workspace_id is not null) <> (session_id is not null))
);

create index invites_workspace_id_idx on public.invites (workspace_id);

-- ---------------------------------------------------------------------------
-- RLS helpers
--
-- security definer so these can read workspace_memberships without
-- recursing through the RLS policy that's about to be defined on it.
-- ---------------------------------------------------------------------------

create function public.is_active_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_memberships
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_memberships
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: workspaces
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;

-- F&F workspaces are always-public by design (§ 8.2) and skip the
-- membership check entirely; standard workspaces require active membership.
create policy "Workspaces are visible to members, F&F workspaces to everyone"
  on public.workspaces for select
  using (type = 'ff' or public.is_active_workspace_member(id));

create policy "Authenticated users can create a workspace"
  on public.workspaces for insert
  with check (auth.uid() = created_by);

create policy "Admins can update their workspace"
  on public.workspaces for update
  using (public.is_workspace_admin(id));

-- ---------------------------------------------------------------------------
-- RLS: workspace_memberships
-- ---------------------------------------------------------------------------

alter table public.workspace_memberships enable row level security;

-- You can always see your own membership row (active or pending); active
-- members see the rest of the active roster; admins additionally see
-- pending rows so they can work the request queue (§ 8.2).
create policy "Members and admins can view workspace memberships"
  on public.workspace_memberships for select
  using (
    user_id = auth.uid()
    or (status = 'active' and public.is_active_workspace_member(workspace_id))
    or public.is_workspace_admin(workspace_id)
  );

-- Self-service insert only: founding a workspace (admin row) and joining by
-- code (member row) both insert the caller's own membership. Elevated
-- inserts go through the security-definer functions below, not this policy.
create policy "Users can insert their own membership"
  on public.workspace_memberships for insert
  with check (user_id = auth.uid());

create policy "Admins can update memberships in their workspace"
  on public.workspace_memberships for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "Admins can remove memberships in their workspace"
  on public.workspace_memberships for delete
  using (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- RLS: invites
--
-- No select policy for non-admins: redemption goes through
-- join_workspace_by_code() (security definer, below), which can read the
-- one matching row without the caller needing broad table access. Letting
-- any authenticated user select from this table would let them enumerate
-- every workspace's invite codes.
-- ---------------------------------------------------------------------------

alter table public.invites enable row level security;

create policy "Admins can view invites for their workspace"
  on public.invites for select
  using (workspace_id is not null and public.is_workspace_admin(workspace_id));

create policy "Admins can create invites for their workspace"
  on public.invites for insert
  with check (
    workspace_id is not null
    and public.is_workspace_admin(workspace_id)
    and created_by = auth.uid()
  );

create policy "Admins can update invites for their workspace"
  on public.invites for update
  using (workspace_id is not null and public.is_workspace_admin(workspace_id));

create policy "Admins can delete invites for their workspace"
  on public.invites for delete
  using (workspace_id is not null and public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- RPCs
--
-- Both wrap a multi-step write (create workspace + seed admin membership;
-- validate code + insert/upgrade membership + bump uses_count) in one
-- security-definer transaction so it can't partially apply — e.g. a
-- workspace created without its founding admin membership would be
-- immediately invisible to its own creator under the select policy above.
-- ---------------------------------------------------------------------------

create function public.create_workspace(p_name text, p_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  if p_type not in ('standard', 'ff') then
    return jsonb_build_object('success', false, 'error', 'Invalid workspace type');
  end if;

  insert into public.workspaces (name, type, created_by)
  values (p_name, p_type, auth.uid())
  returning id into v_workspace_id;

  insert into public.workspace_memberships (workspace_id, user_id, role, status)
  values (v_workspace_id, auth.uid(), 'admin', 'active');

  return jsonb_build_object('success', true, 'workspace_id', v_workspace_id);
end;
$$;

create function public.join_workspace_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_status text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select * into v_invite
  from public.invites
  where code = p_code
    and workspace_id is not null
  for update;

  if not found
    or (v_invite.expires_at is not null and v_invite.expires_at < now())
    or (v_invite.max_uses is not null and v_invite.uses_count >= v_invite.max_uses)
  then
    return jsonb_build_object('success', false, 'error', 'Invalid or expired code');
  end if;

  v_status := case when v_invite.requires_verification then 'pending' else 'active' end;

  insert into public.workspace_memberships (workspace_id, user_id, role, status)
  values (v_invite.workspace_id, auth.uid(), 'member', v_status)
  on conflict (workspace_id, user_id) do update
    set status = case
      when public.workspace_memberships.status = 'active' then 'active'
      else excluded.status
    end;

  update public.invites set uses_count = uses_count + 1 where id = v_invite.id;

  return jsonb_build_object('success', true, 'workspace_id', v_invite.workspace_id, 'status', v_status);
end;
$$;
