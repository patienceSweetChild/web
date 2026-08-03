-- Backfill profiles for auth users who signed up but have no public.profiles row.
-- Paste into Supabase SQL Editor and run once, then refresh Admin Panel.

INSERT INTO public.profiles (id, email, full_name, display_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'display_name',
    split_part(u.email, '@', 1)
  ),
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  ),
  'viewer'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;
