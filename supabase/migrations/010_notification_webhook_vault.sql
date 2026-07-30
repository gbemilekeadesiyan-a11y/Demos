-- Follow-up to 009_notifications.sql: trigger_notify_events() originally
-- read its URL/secret via current_setting('app.settings.*'), set through
-- `alter database postgres set ...`. That command turns out to require
-- superuser and is rejected on Supabase's hosted platform ("permission
-- denied to set parameter") even for the project owner. Supabase Vault
-- (supabase_vault, already enabled on every project) is the actual
-- supported way to store a secret a trigger function can read — encrypted
-- at rest, rather than a plaintext database setting anyway.
--
-- REQUIRED one-time setup (run once, directly — not part of this
-- migration, same reasoning as before: real per-project secret values
-- don't belong in a file committed to git):
--
--   select vault.create_secret(
--     'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/notify-events',
--     'notify_events_url'
--   );
--   select vault.create_secret(
--     '<A_RANDOM_SECRET_YOU_GENERATE>',
--     'notify_events_secret'
--   );
--
-- (Re-running vault.create_secret with the same name errors on a unique
-- constraint — use vault.update_secret(id, secret) to change a value.)

create or replace function public.trigger_notify_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'notify_events_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'notify_events_secret';

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
      raise warning 'notify_events dispatch failed: %', sqlerrm;
  end;

  return coalesce(new, old);
end;
$$;
