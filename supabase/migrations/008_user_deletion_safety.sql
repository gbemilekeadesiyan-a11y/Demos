-- Prevents account deletion from cascade-destroying workspaces/sessions
-- that belong to other people. Previously workspaces.created_by and
-- voting_sessions.created_by referenced auth.users(id) on delete cascade:
-- deleting a user who founded a workspace or created a session would take
-- the whole workspace (all members' memberships, invites, sessions,
-- options, votes, vote_selections) or that one session (options, votes,
-- vote_selections, access grants) down with them.
--
-- created_by is purely informational on both tables — actual admin
-- permissions come from workspace_memberships.role via is_workspace_admin()
-- (003_workspaces.sql), never from created_by — so nulling it on user
-- deletion breaks no permission logic.
--
-- Paired with deleteAccount() (app/(auth)/_lib/actions.ts) calling
-- auth.admin.deleteUser(id, true) — shouldSoftDelete bans the auth.users
-- row rather than removing it, so this FK change should rarely even fire
-- in practice. It's a schema-level backstop for if that's ever bypassed
-- (a different code path, a manual dashboard hard-delete, a future bug).

alter table public.workspaces
  drop constraint workspaces_created_by_fkey,
  alter column created_by drop not null,
  add constraint workspaces_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;

alter table public.voting_sessions
  drop constraint voting_sessions_created_by_fkey,
  alter column created_by drop not null,
  add constraint voting_sessions_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete set null;
