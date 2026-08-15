-- Read-only counterpart to join_workspace_by_code (003_workspaces.sql):
-- app/join/page.tsx needs to know a code's target workspace (type, name)
-- before deciding which branch to show — sign-in/sign-up prompt, direct
-- join, or the password-switch flow for an ff-group code — but the
-- existing invites SELECT policy requires is_workspace_admin(workspace_id),
-- which a plain invitee doesn't have. This peeks without consuming a use or
-- writing a membership row; the actual join still goes through
-- join_workspace_by_code once the user commits.

create function public.peek_workspace_invite_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_workspace public.workspaces%rowtype;
begin
  select * into v_invite
  from public.invites
  where code = p_code
    and workspace_id is not null;

  if not found
    or (v_invite.expires_at is not null and v_invite.expires_at < now())
    or (v_invite.max_uses is not null and v_invite.uses_count >= v_invite.max_uses)
  then
    return jsonb_build_object('success', false, 'error', 'Invalid or expired code');
  end if;

  select * into v_workspace from public.workspaces where id = v_invite.workspace_id;

  return jsonb_build_object(
    'success', true,
    'workspace_id', v_workspace.id,
    'workspace_type', v_workspace.type,
    'workspace_name', v_workspace.name
  );
end;
$$;
