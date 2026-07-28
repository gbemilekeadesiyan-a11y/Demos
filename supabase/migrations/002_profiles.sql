-- Auth & Identity module — public.profiles table + auto-create trigger.
-- See demos-system-design.md § 8.1.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth.users row appears (password
-- signup or SSO, per § 8.1). Anonymous sign-ins are skipped — they have no
-- email/username to seed a profile from (see § 8.1, "Anonymous voting").
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_anonymous then
    return new;
  end if;

  insert into public.profiles (id, username, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
    
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  first_name text not null,
  last_name text not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- anonymous users have no username in metadata — skip creating a profile row for them,
  -- matching the design decision that anon voters don't get one
  if new.raw_user_meta_data->>'username' is not null then
    insert into public.profiles (id, username, first_name, last_name)
    values (
      new.id,
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'first_name',
      new.raw_user_meta_data->>'last_name'
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();