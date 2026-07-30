-- Results, Realtime & Notifications module — in-app notifications table +
-- the trigger wiring that fires the notify-events Edge Function.
-- See demos-system-design.md § 8.4.
--
-- Note: 007 and 008 were already taken (007_session_results_realtime.sql,
-- 008_user_deletion_safety.sql), so this one picks up at 009.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_read_idx on public.notifications (user_id, read);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No insert/delete policy for regular users: rows are written only by the
-- notify-events Edge Function using the service_role key (bypasses RLS
-- entirely) — see supabase/functions/notify-events/index.ts.

-- ---------------------------------------------------------------------------
-- Trigger wiring
--
-- Fires the notify-events Edge Function via pg_net (net.http_post), the
-- same async-HTTP primitive Supabase's own dashboard "Database Webhooks"
-- feature is built on — chosen over supabase_functions.http_request so the
-- destination URL and a shared secret can be read from database config at
-- call time instead of being embedded as literals in this file. That
-- matters here specifically because both values differ per environment and
-- neither belongs in git: the URL contains your project ref, and the
-- secret is what stops anyone who finds the function's public URL
-- (required — see below) from posting fake events to it.
--
-- REQUIRED one-time setup, run directly against your database — NOT part
-- of this migration, on purpose, since these are per-project secrets:
--
--   alter database postgres set app.settings.notify_events_url =
--     'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/notify-events';
--   alter database postgres set app.settings.notify_events_secret =
--     '<A_RANDOM_SECRET_YOU_GENERATE>';
--
-- Then set the same secret as the Edge Function's WEBHOOK_SECRET
-- (`supabase secrets set WEBHOOK_SECRET=<same value>`), and deploy with
-- `supabase functions deploy notify-events --no-verify-jwt` — no-verify-jwt
-- because a database trigger has no user session/JWT to present, which is
-- also why the shared secret above is what actually protects the endpoint.
--
-- Until both settings are configured, trigger_notify_events() below is a
-- deliberate no-op (see the null check) rather than an error, so normal
-- session/invite writes never fail just because notifications aren't wired
-- up yet in a given environment (e.g. local dev).
-- ---------------------------------------------------------------------------

create extension if not exists pg_net;

create function public.trigger_notify_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := current_setting('app.settings.notify_events_url', true);
  v_secret text := current_setting('app.settings.notify_events_secret', true);
begin
  if v_url is null or v_secret is null then
    return coalesce(new, old);
  end if;

  begin
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
      body := jsonb_build_object(
        'type', tg_op,
        'table', tg_table_name,
        'schema', tg_table_schema,
        'record', to_jsonb(new),
        'old_record', to_jsonb(old)
      )
    );
  exception
    when others then
      -- A broken/misconfigured webhook must never block the underlying
      -- session status change or invite creation it's reacting to.
      raise warning 'notify_events dispatch failed: %', sqlerrm;
  end;

  return coalesce(new, old);
end;
$$;

create trigger on_voting_session_status_change
  after update on public.voting_sessions
  for each row
  when (new.status is distinct from old.status and new.status in ('open', 'results_released'))
  execute function public.trigger_notify_events();

create trigger on_workspace_invite_created
  after insert on public.invites
  for each row
  when (new.workspace_id is not null)
  execute function public.trigger_notify_events();
