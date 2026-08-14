-- Session-scoped voting invites — activates the invites.session_id column
-- that's existed since 003_workspaces.sql but never had RLS coverage or a
-- writer. Scoped to ff, public_link, anonymous-voting-enabled sessions only:
-- that's the one combination where can_access_session() already lets an
-- anonymous sign-in (see enforce_ff_workspace_session_visibility in
-- 011_ff_workspaces.sql for why ff sessions can't be invited_list/departments)
-- through today, so redemption needs no new access-grant machinery — the
-- code's job is UX (a landing page + a use counter), not access control.

create policy "Admins can view invites for their session"
  on public.invites for select
  using (
    session_id is not null
    and public.is_workspace_admin((select workspace_id from public.voting_sessions where id = session_id))
  );

create policy "Admins can create invites for their public-link ff session"
  on public.invites for insert
  with check (
    session_id is not null
    and created_by = auth.uid()
    and public.is_workspace_admin((select workspace_id from public.voting_sessions where id = session_id))
    and exists (
      select 1
      from public.voting_sessions vs
      join public.workspaces w on w.id = vs.workspace_id
      where vs.id = session_id
        and w.type = 'ff'
        and vs.who_can_vote = 'public_link'
        and vs.allow_anonymous_vote = true
    )
  );

-- Mirrors join_workspace_by_code (003_workspaces.sql) but with no
-- auth.uid() requirement — this must be callable by a visitor who hasn't
-- signed in (anonymously or otherwise) yet.
create function public.redeem_session_invite_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_session public.voting_sessions%rowtype;
begin
  select * into v_invite
  from public.invites
  where code = p_code
    and session_id is not null
  for update;

  if not found
    or (v_invite.expires_at is not null and v_invite.expires_at < now())
    or (v_invite.max_uses is not null and v_invite.uses_count >= v_invite.max_uses)
  then
    return jsonb_build_object('success', false, 'error', 'Invalid or expired code');
  end if;

  select * into v_session from public.voting_sessions where id = v_invite.session_id;

  update public.invites set uses_count = uses_count + 1 where id = v_invite.id;

  return jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'session_title', v_session.title
  );
end;
$$;
