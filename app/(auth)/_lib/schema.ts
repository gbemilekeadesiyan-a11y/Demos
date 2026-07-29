// Shared across features: anywhere a user is referenced in a return type,
// this carries their profile instead of a bare UUID. See public.profiles
// in supabase/migrations/002_profiles.sql — username/first_name/last_name.
// Anonymous users have no profiles row, so callers get null instead of a
// UserSummary rather than the query failing.
export type UserSummary = {
  id: string
  username: string
  firstName: string
  lastName: string
}
