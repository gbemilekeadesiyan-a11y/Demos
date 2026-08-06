-- Per-surface account access. See demos-system-design.md § 8.1.
--
-- Until now, "which surfaces can this account use" wasn't a concept at
-- all — every account could see both the F&F and Workspaces surfaces, and
-- workspaces.type (003_workspaces.sql, 011_ff_workspaces.sql) was the only
-- ff/standard differentiator, scoped to a single workspace rather than the
-- account. This adds the account-level gate; workspaces.type is unchanged
-- and still governs per-workspace behavior (private mode, ballot secrecy
-- defaults, etc.) — the two concerns compose rather than one replacing the
-- other.

alter table public.profiles add column has_ff boolean not null default false;
alter table public.profiles add column has_workspaces boolean not null default false;

-- Backfill before the check constraint below can be added: existing rows
-- are all false/false right now (the columns were just added), which the
-- constraint forbids. Grant surface access based on the workspaces a user
-- is already an active member of, rather than defaulting everyone to both
-- indiscriminately.
update public.profiles p
set has_ff = true
where exists (
  select 1
  from public.workspace_memberships wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.user_id = p.id and wm.status = 'active' and w.type = 'ff'
);

update public.profiles p
set has_workspaces = true
where exists (
  select 1
  from public.workspace_memberships wm
  join public.workspaces w on w.id = wm.workspace_id
  where wm.user_id = p.id and wm.status = 'active' and w.type = 'standard'
);

-- Safety net for accounts with no memberships yet (nothing above touched
-- them) — still needed to satisfy the constraint. Workspaces is the
-- pre-existing default surface, so that's what they fall back to.
update public.profiles
set has_workspaces = true
where not has_ff and not has_workspaces;

alter table public.profiles
  add constraint profiles_has_surface_access check (has_ff or has_workspaces);

-- ---------------------------------------------------------------------------
-- handle_new_user() — read surface grants from signup metadata
--
-- Keys here must match what signUp() sends in app/(auth)/_lib/actions.ts.
-- No fallback default on either side: signUp() rejects a signup where
-- neither surface is selected before auth.signUp() is ever called, so by
-- the time this trigger fires the metadata is expected to already satisfy
-- the check constraint above.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_anonymous then
    return new;
  end if;

  insert into public.profiles (id, username, first_name, last_name, has_ff, has_workspaces)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    coalesce((new.raw_user_meta_data ->> 'has_ff')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'has_workspaces')::boolean, false)
  );

  return new;
end;
$$;
