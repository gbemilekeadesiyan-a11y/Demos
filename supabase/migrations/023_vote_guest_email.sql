-- Lets an anonymous ("vote without account") voter optionally leave an
-- email so notify-events can send them the results link when the session
-- releases — see supabase/functions/notify-events/index.ts. Registered
-- voters never set this; they're already reachable via auth.users.

alter table public.votes add column guest_email text;

-- Same auth.uid()-scoped-write-via-RPC pattern as cast_vote itself
-- (005_voting_sessions.sql) rather than opening a general UPDATE policy on
-- votes — this only ever touches the caller's own row's guest_email.
create function public.set_vote_guest_email(p_session_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  update public.votes
  set guest_email = p_email
  where session_id = p_session_id and user_id = auth.uid();

  if not found then
    return jsonb_build_object('success', false, 'error', 'Vote not found');
  end if;

  return jsonb_build_object('success', true);
end;
$$;
