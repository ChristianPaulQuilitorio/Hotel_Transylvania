-- Migration: Make a specific user an administrator
-- Date: 2025-11-28
-- This migration will:
-- 1) Ensure the `profiles` table has `role` (text) and `is_admin` (boolean) columns.
-- 2) Insert a profiles row if it doesn't exist for the given user id.
-- 3) Mark the user as admin by setting role='admin' and is_admin=true.
-- 4) Update `auth.users` raw metadata to include role if present.

BEGIN;

-- 1) Add columns if missing
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS role text;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 2) Ensure a profiles row exists for the user (use provided id/email)
-- Replace values below if you need a different email/username
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '02db459a-6d83-4825-8f1d-3e05f69fd129') THEN
    INSERT INTO public.profiles (id, email, username, role, is_admin, created_at)
    VALUES ('02db459a-6d83-4825-8f1d-3e05f69fd129', '202310339@gordoncollege.edu.ph', NULL, 'admin', true, now());
  END IF;
END$$;

-- 3) Mark the user as admin
UPDATE public.profiles
SET role = 'admin', is_admin = true
WHERE id = '02db459a-6d83-4825-8f1d-3e05f69fd129';

-- 4) If your Supabase instance stores metadata in auth.users.raw_user_meta_data,
-- add a role field there as well so server-side checks can read it.
-- Note: modifying auth tables requires service role privileges.

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{role}', '"admin"'::jsonb, true)
WHERE id = '02db459a-6d83-4825-8f1d-3e05f69fd129';

COMMIT;

-- End of migration
