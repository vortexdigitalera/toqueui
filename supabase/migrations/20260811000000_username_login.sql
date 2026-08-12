-- ============================================================
-- Migration: Username login support
-- ============================================================
-- Adds a unique `username` column to user_profiles (backfilled from
-- the email local-part), and a SECURITY DEFINER resolver so the login
-- page can accept either a username or a full email address.
-- The resolver only returns a matching email — never credentials.
-- ============================================================

-- 1. Add username column (unique, backfill from email local-part)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

UPDATE public.user_profiles
SET username = split_part(email, '@', 1)
WHERE username IS NULL AND email IS NOT NULL
  AND split_part(email, '@', 1) NOT IN (
    SELECT username FROM public.user_profiles WHERE username IS NOT NULL
  );

-- 2. Unique index on username (case-insensitive-ish via lower())
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_lower
  ON public.user_profiles (lower(username))
  WHERE username IS NOT NULL;

-- 3. Resolver: username / local-part / full_name -> email
CREATE OR REPLACE FUNCTION public.resolve_login_identity(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_needle TEXT := trim(coalesce(p_username, ''));
  v_email  TEXT;
BEGIN
  IF v_needle = '' THEN
    RETURN NULL;
  END IF;

  -- Exact username match
  SELECT email INTO v_email
  FROM public.user_profiles
  WHERE lower(username) = lower(v_needle)
  LIMIT 1;

  -- Fall back to email local-part
  IF v_email IS NULL THEN
    SELECT email INTO v_email
    FROM public.user_profiles
    WHERE lower(split_part(email, '@', 1)) = lower(v_needle)
    LIMIT 1;
  END IF;

  -- Fall back to full name
  IF v_email IS NULL THEN
    SELECT email INTO v_email
    FROM public.user_profiles
    WHERE lower(full_name) = lower(v_needle)
    LIMIT 1;
  END IF;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_identity(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_identity(TEXT) TO anon, authenticated;

-- 4. Backfill username on new signups too
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')::public.user_role,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
