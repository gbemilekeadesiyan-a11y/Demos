-- Follow-up to 009_notifications.sql: the notification centre subscribes to
-- postgres_changes on public.notifications (see
-- app/notifications/_components/NotificationBell.tsx), which — same as
-- 007_session_results_realtime.sql — delivers nothing until the table is
-- added to this publication. The existing "Users can view their own
-- notifications" RLS policy still scopes delivery to each subscriber's own
-- rows on top of this.
alter publication supabase_realtime add table public.notifications;
