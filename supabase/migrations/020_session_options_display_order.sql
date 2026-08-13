-- session_options.display_order was added to 005_voting_sessions.sql after
-- that migration had already been applied, so the column never made it to
-- the database. app/sessions/_lib/actions.ts already depends on it
-- (addSessionOption, and ordering options in session detail queries).

alter table public.session_options
  add column display_order integer not null default 0;

create index session_options_session_id_display_order_idx
  on public.session_options (session_id, display_order);
