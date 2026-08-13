-- Optional F&F setting: let a group's admin allow ordinary (non-admin)
-- members to create voting sessions too, not just admins. Off by default —
-- existing behavior (005_voting_sessions.sql: admin-only) is unchanged
-- unless an admin opts in.
--
-- Stored in workspaces.settings (existing jsonb column, previously unused)
-- rather than a new typed column — this is a single per-workspace boolean
-- flag, not a structured entity, and the Workspace type already models
-- `settings` as an open bag read/written by app/workspaces/_lib/actions.ts.
--
-- Scoped to ff workspaces only, enforced here rather than left as a
-- UI-only convention — same reasoning as enforce_ff_workspace_session_visibility
-- in 011_ff_workspaces.sql: standard workspaces keep admin-only session
-- creation regardless of what ends up in their settings blob.

drop policy "Admins can create sessions in their workspace" on public.voting_sessions;

create policy "Admins, or any member when an ff group allows it, can create sessions"
  on public.voting_sessions for insert
  with check (
    created_by = auth.uid()
    and (
      public.is_workspace_admin(workspace_id)
      or (
        public.is_active_workspace_member(workspace_id)
        and exists (
          select 1 from public.workspaces w
          where w.id = workspace_id
            and w.type = 'ff'
            and coalesce((w.settings ->> 'membersCanCreateSessions')::boolean, false)
        )
      )
    )
  );
