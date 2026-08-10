-- ============================================================
-- Migration: Fix missing auth.identities for existing users
-- ============================================================
-- Supabase requires an entry in auth.identities for every user
-- that signs in with email+password. Without it, signInWithPassword
-- returns "Invalid login credentials" even with the correct password.
-- This migration inserts the missing identity rows for all users
-- that were created directly in auth.users (bypassing the normal
-- signup flow) and therefore have no identity record.

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  u.id::text,           -- provider_id = user id (standard for email provider)
  'email',
  jsonb_build_object(
    'sub',              u.id::text,
    'email',            u.email,
    'email_verified',   true,
    'provider',         'email'
  ),
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  );
