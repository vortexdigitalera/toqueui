-- ============================================================
-- Migration: Add super_admin role and insert rhsalisu user
-- ============================================================

-- 1. Add 'super_admin' value to the existing user_role enum
-- NOTE: ALTER TYPE ... ADD VALUE cannot be used in a transaction block
-- that also references the new value. We add it first, then commit,
-- then use it in subsequent statements.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- COMMIT is implicit here; the enum value is now visible to subsequent statements.

-- 2. Update helper function to also recognise super_admin as admin-equivalent
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin'::public.user_role, 'super_admin'::public.user_role)
  );
$$;

-- 3. Update get_current_user_role to include super_admin
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 4. Insert rhsalisu as super_admin
DO $$
DECLARE
  rhsalisu_uuid UUID := gen_random_uuid();
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    rhsalisu_uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rhsalisu@gmail.com',
    crypt('R@b1u2004@', gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    jsonb_build_object('full_name', 'rhsalisu', 'role', 'super_admin'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  )
  ON CONFLICT (email) DO NOTHING;

  -- Insert user_profiles row (in case trigger already ran or needs manual insert)
  INSERT INTO public.user_profiles (id, email, full_name, role)
  SELECT rhsalisu_uuid, 'rhsalisu@gmail.com', 'rhsalisu', 'super_admin'::public.user_role
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE email = 'rhsalisu@gmail.com'
  );

  -- If user already existed in auth.users (conflict on email), update their profile role
  UPDATE public.user_profiles
  SET role = 'super_admin'::public.user_role,
      full_name = 'rhsalisu',
      updated_at = now()
  WHERE email = 'rhsalisu@gmail.com'
    AND role != 'super_admin'::public.user_role;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'super_admin user insertion failed: %', SQLERRM;
END $$;
