-- Turns on Realtime (Postgres Changes) delivery for live-updating session
-- results. Subscribing via supabase-js's postgres_changes without a table
-- being in this publication silently receives nothing — this is what
-- actually enables events. Existing RLS select policies on these tables
-- still apply per-subscriber on top of this, so a client only receives
-- change events for rows it's already allowed to read.
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.vote_selections;
