-- Workspace/Membership module additions: direct invites (admin invites a
-- specific person, as opposed to a shareable code), owner semantics on
-- workspaces.created_by, and ownership transfer. See
-- app/workspaces/_lib/actions.ts (inviteByIdentifier, respondToInvite,
-- leaveWorkspace, transferOwnership) and demos-system-design.md § 8.2.
--
-- Applies to both Workspaces and F&F groups — F&F groups are workspaces
-- rows with type = 'ff' (011_ff_workspaces.sql), not a parallel table, so
-- everything here (RLS, RPCs) already covers both surfaces without any
-- type-specific branching.

-- ---------------------------------------------------------------------------
-- workspace_memberships.initiated_by — disambiguates the two ways a
-- 'pending' row can come to exist:
--   'self'  — the user asked to join (join_workspace_by_code with
--             requires_verification); an admin approves/rejects
--             (approveMembership/rejectMembership, unchanged below).
--   'admin' — an admin invited this specific person
--             (invite_by_identifier below); the invited user accepts/
--             declines (respond_to_invite below).
-- Existing rows (all created via create_workspace or join_workspace_by_code)
-- are self-initiated, hence the 'self' default backfilling them for free.
-- ---------------------------------------------------------------------------

alter table public.workspace_memberships
  add column initiated_by text not null default 'self' check (initiated_by in ('self', 'admin'));

-- ---------------------------------------------------------------------------
-- Owner semantics — workspaces.created_by is "the owner": can promote/
-- demote other admins via updateMemberRole (already works today — the
-- owner's founding membership row has role = 'admin', so is_workspace_admin
-- already covers them), but cannot themselves be demoted or removed, and
-- workspaces.created_by can only change via transfer_workspace_ownership()
-- below. Enforced here in RLS/triggers, not just app code, so a direct
-- table write (buggy or malicious) is blocked the same as one that goes
-- through the app.
-- ---------------------------------------------------------------------------

create function public.is_workspace_owner(target_workspace_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces
    where id = target_workspace_id and created_by = target_user_id
  );
$$;

-- Tightened: admins can no longer touch the owner's own membership row.
drop policy "Admins can update memberships in their workspace" on public.workspace_memberships;

create policy "Admins can update memberships in their workspace, except the owner's own row"
  on public.workspace_memberships for update
  using (public.is_workspace_admin(workspace_id) and not public.is_workspace_owner(workspace_id, user_id))
  with check (public.is_workspace_admin(workspace_id) and not public.is_workspace_owner(workspace_id, user_id));

drop policy "Admins can remove memberships in their workspace" on public.workspace_memberships;

create policy "Admins can remove memberships in their workspace, except the owner's own row"
  on public.workspace_memberships for delete
  using (public.is_workspace_admin(workspace_id) and not public.is_workspace_owner(workspace_id, user_id));

-- New: self-service leave (leaveWorkspace) — there was previously no policy
-- letting a non-admin member remove their own membership at all. Excludes
-- the owner's row same as above, so leaveWorkspace's app-level "Transfer
-- ownership before leaving." check has real RLS backing it, not just being
-- a nicer error message in front of a delete that would've worked anyway.
create policy "Members can remove their own membership, unless they're the owner"
  on public.workspace_memberships for delete
  using (user_id = auth.uid() and not public.is_workspace_owner(workspace_id, user_id));

-- workspaces.created_by can only change via transfer_workspace_ownership()
-- (below), which sets this session-local flag before its own update. A
-- direct update — even one that would otherwise pass the existing "Admins
-- can update their workspace" policy, since that policy doesn't
-- distinguish which columns are being changed — is rejected. Mirrors the
-- app.settings.* session-flag pattern already used for the notify-events
-- webhook (009_notifications.sql), and the trigger-based cross-table
-- enforcement style used for F&F session visibility (011_ff_workspaces.sql)
-- — a plain check constraint can't express "only this function may change
-- this column."
create function public.prevent_direct_ownership_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by
    and coalesce(current_setting('app.transferring_ownership', true), 'false') <> 'true'
  then
    raise exception 'workspaces.created_by can only change via transfer_workspace_ownership()';
  end if;
  return new;
end;
$$;

create trigger enforce_ownership_transfer_path
  before update of created_by on public.workspaces
  for each row
  execute function public.prevent_direct_ownership_change();

-- approveMembership/rejectMembership are the admin-approves-a-request
-- direction — scope them to 'self'-initiated rows so they can't be used to
-- accept/reject on behalf of someone else's pending admin-initiated invite
-- (that's respond_to_invite's job, below, and only the invited user can
-- call it on their own row).
--
-- No RLS change needed for the app-level filtering below to be meaningful:
-- the "Admins can update/remove memberships" policies already gate these to
-- admins of the workspace, and respond_to_invite (a separate security
-- definer function) is the only other writer of 'admin'-initiated rows.

-- ---------------------------------------------------------------------------
-- invite_by_identifier — admin invites a specific person by username or
-- email, distinct from generateInvite's shareable code. Resolves the
-- identifier, creates a 'pending'/'admin'-initiated membership, and drops
-- an in-app notification for the invited user in one transaction, so a
-- partial failure can't leave a membership row with no notification (or
-- vice versa). security definer because: (1) auth.users isn't exposed via
-- the REST API, so the email half of identifier resolution needs elevated
-- access (same reasoning as email_exists, 004_auth_email_lookup.sql), (2)
-- inserting a membership row for someone *other than the caller* isn't
-- covered by "Users can insert their own membership" (self-service only),
-- and (3) there's no insert policy on notifications for regular users at
-- all (009_notifications.sql) — rows are written by trusted server-side
-- paths only, and this is now one of them.
--
-- Deliberately doesn't extend the notify-events Edge Function to email this
-- notification — that's a larger, separate change (a new trigger + email
-- draft in supabase/functions/notify-events/index.ts); this only adds the
-- in-app row, matching what was actually asked for.
-- ---------------------------------------------------------------------------

create function public.invite_by_identifier(p_workspace_id uuid, p_identifier text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_membership_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  if not public.is_workspace_admin(p_workspace_id) then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;

  if p_role not in ('admin', 'moderator', 'member') then
    return jsonb_build_object('success', false, 'error', 'Invalid role');
  end if;

  -- Username first (unique, case-sensitive — see profiles.username,
  -- 002_profiles.sql), then email (case-insensitive, matching
  -- email_exists' lower() comparison, 004_auth_email_lookup.sql).
  select id into v_user_id from public.profiles where username = p_identifier;

  if v_user_id is null then
    select id into v_user_id from auth.users where lower(email) = lower(p_identifier);
  end if;

  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Account does not exist');
  end if;

  if exists (
    select 1 from public.workspace_memberships
    where workspace_id = p_workspace_id and user_id = v_user_id
  ) then
    return jsonb_build_object('success', false, 'error', 'This person is already a member or has a pending invite');
  end if;

  insert into public.workspace_memberships (workspace_id, user_id, role, status, initiated_by)
  values (p_workspace_id, v_user_id, p_role, 'pending', 'admin')
  returning id into v_membership_id;

  insert into public.notifications (user_id, type, payload)
  values (
    v_user_id,
    'workspace_direct_invite',
    jsonb_build_object(
      'workspaceId', p_workspace_id,
      'membershipId', v_membership_id,
      'role', p_role,
      'invitedBy', auth.uid()
    )
  );

  return jsonb_build_object('success', true, 'membership_id', v_membership_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- respond_to_invite — the invited user accepts (status -> 'active') or
-- declines (row deleted) an admin-initiated invite. security definer so it
-- can update/delete the row without a new self-service RLS policy (the
-- existing admin-only update/delete policies deliberately don't cover
-- this — see the "elevated writes go through security-definer functions"
-- pattern already established for create_workspace/join_workspace_by_code
-- in 003_workspaces.sql). Scoped to the caller's own row, 'pending' status,
-- and 'admin'-initiated only — an accept/decline on a 'self'-initiated
-- (join-request) row goes through approveMembership/rejectMembership
-- instead, not this.
-- ---------------------------------------------------------------------------

create function public.respond_to_invite(p_membership_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.workspace_memberships%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select * into v_membership
  from public.workspace_memberships
  where id = p_membership_id
  for update;

  if not found
    or v_membership.user_id <> auth.uid()
    or v_membership.status <> 'pending'
    or v_membership.initiated_by <> 'admin'
  then
    return jsonb_build_object('success', false, 'error', 'Invite not found');
  end if;

  if p_accept then
    update public.workspace_memberships set status = 'active' where id = p_membership_id;
  else
    delete from public.workspace_memberships where id = p_membership_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- transfer_workspace_ownership — the only sanctioned way to change
-- workspaces.created_by (see the trigger above). Caller must be the
-- *current* owner (not just any admin) — this is how leaveWorkspace's
-- owner-block gets resolved. The incoming owner is promoted to
-- role = 'admin' if they aren't already, since ownership without
-- is_workspace_admin-level access (which gates workspace updates, member
-- management, invites, etc.) would be a broken, self-contradictory state.
-- ---------------------------------------------------------------------------

create function public.transfer_workspace_ownership(p_workspace_id uuid, p_new_owner_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_owner uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  select created_by into v_current_owner from public.workspaces where id = p_workspace_id;

  if v_current_owner is null then
    return jsonb_build_object('success', false, 'error', 'Workspace not found');
  end if;

  if v_current_owner <> auth.uid() then
    return jsonb_build_object('success', false, 'error', 'Only the current owner can transfer ownership');
  end if;

  if not exists (
    select 1 from public.workspace_memberships
    where workspace_id = p_workspace_id and user_id = p_new_owner_user_id and status = 'active'
  ) then
    return jsonb_build_object('success', false, 'error', 'New owner must be an active member of this workspace');
  end if;

  update public.workspace_memberships
  set role = 'admin'
  where workspace_id = p_workspace_id and user_id = p_new_owner_user_id and role <> 'admin';

  perform set_config('app.transferring_ownership', 'true', true);

  update public.workspaces set created_by = p_new_owner_user_id where id = p_workspace_id;

  return jsonb_build_object('success', true);
end;
$$;
