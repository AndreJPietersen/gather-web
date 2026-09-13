-- Auto-creates a `public.profiles` row whenever a new user signs up via
-- Supabase Auth. Without this, auth.users and public.profiles would drift
-- out of sync — every signup needs a profile row to exist immediately for
-- the app's RLS policies (which reference public.profiles / profile ids
-- via auth.uid()) and UI to work at all.
--
-- Note: this lives in supabase/migrations (Supabase CLI's own migration
-- tracking) rather than Drizzle's, because it touches the auth schema,
-- which Drizzle doesn't manage. This means `supabase db reset` (which
-- replays everything under supabase/migrations from scratch) will NOT
-- recreate the Drizzle-managed tables (events, vendors, etc.) — always run
-- `npm run db:push` again after any `supabase db reset` to restore them.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Drizzle can't declare this (it doesn't manage the auth schema), but without
-- it, deleting a user from auth.users would leave an orphaned profiles row.
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;
