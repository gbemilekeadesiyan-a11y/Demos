-- F&F workspace behavior — "always-public, casual, no private mode."
-- See demos-system-design.md § 8.2 and the original product doc (§1
-- Overview: "DEMOS F&F (always-public, casual, no private mode...)").
--
-- Note: 008, 009, and 010 were already taken (008_user_deletion_safety.sql,
-- 009_notifications.sql, 010_notification_webhook_vault.sql), so this one
-- picks up at 011.

-- ---------------------------------------------------------------------------
-- Enforcement: a session in an F&F workspace can't be private or
-- invite-only.
--
-- This has to be a trigger, not a plain `check` constraint — a check
-- constraint can't reference another table (voting_sessions doesn't carry
-- the workspace's type itself), and Postgres requires check expressions to
-- be immutable/self-contained.
--
-- Fires on insert *and* on update of the columns that matter, not just
-- creation: the existing "Admins can update sessions in their workspace"
-- policy (005_voting_sessions.sql) would otherwise let someone create a
-- compliant public/all_members session and flip it to private/invited_list
-- afterward, which would make this a UI-only rule again — exactly what
-- "enforce at the database level" is supposed to rule out. Also covers
-- update of workspace_id, in case a session is ever reassigned to a
-- different workspace (no action does this today, but the constraint
-- should hold regardless of how a row gets into this state).
-- ---------------------------------------------------------------------------

create function public.enforce_ff_workspace_session_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_type text;
begin
  select type into v_workspace_type from public.workspaces where id = new.workspace_id;

  if v_workspace_type = 'ff' and (new.visibility = 'private' or new.who_can_vote = 'invited_list') then
    raise exception
      'F&F workspaces have no private mode — sessions must be public and open to all_members or public_link, not private or invited_list'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger enforce_ff_workspace_session_visibility_trigger
  before insert or update of visibility, who_can_vote, workspace_id on public.voting_sessions
  for each row
  execute function public.enforce_ff_workspace_session_visibility();

-- ---------------------------------------------------------------------------
-- Audit of existing RLS helpers against ff workspaces — both already behave
-- correctly, so nothing to change; documenting why rather than silently
-- leaving it unclear this was checked:
--
-- is_active_workspace_member() (003_workspaces.sql): membership as a
-- concept isn't affected by "no private mode" — F&F workspaces still have
-- real members, just frictionless-to-join ones. Its logic (active
-- workspace_memberships row) needs no ff-specific branch.
--
-- can_access_session() (005_voting_sessions.sql): "no private mode" is
-- about the workspace's own visibility (already handled by the workspaces
-- select policy: "type = 'ff' or is_active_workspace_member(id)") and, as
-- of this migration, about which who_can_vote values a session can even
-- have — not about bypassing who_can_vote checks at read time. Its
-- who_can_vote = 'all_members' branch correctly still requires active
-- membership for ff sessions (still "members-only voting", just easy
-- membership); its who_can_vote = 'invited_list' branch is simply
-- unreachable for ff sessions now, not incorrect.
-- ---------------------------------------------------------------------------
