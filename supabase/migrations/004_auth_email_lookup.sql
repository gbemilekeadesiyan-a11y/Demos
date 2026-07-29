-- Auth & Identity module addition — lets the login flow distinguish
-- "no account with this email" from "wrong password" (see
-- app/(auth)/_lib/actions.ts). See demos-system-design.md § 8.1.
--
-- security definer because the client can't query auth.users directly;
-- this only ever returns a boolean, never any user data.

create function public.email_exists(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(p_email)
  );
$$;

