-- ============================================================
-- Migration: Add super_admin role and insert rhsalisu user
-- ============================================================

-- 1. Add 'super_admin' value to the existing user_role enum
--    This statement auto-commits the new value (cannot be in a transaction block)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Update helper function — use role::TEXT comparison to avoid casting
--    the newly added enum value in the same transaction
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role::TEXT IN ('admin', 'super_admin')
  );
$$;

-- 3. Update get_current_user_role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 4. Insert rhsalisu as super_admin
--    All references to the new enum value use EXECUTE (dynamic SQL) so they
--    are parsed after the enum value is already committed, avoiding the
--    "unsafe use of new value" error.
DO $$
DECLARE
  rhsalisu_uuid UUID;
BEGIN
  rhsalisu_uuid := gen_random_uuid();

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
    now(), now(), now(),
    jsonb_build_object('full_name', 'rhsalisu', 'role', 'super_admin'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  )
  ON CONFLICT (email) DO NOTHING;

  -- Use EXECUTE so the enum cast is evaluated after the value is committed
  EXECUTE format(
    $sql$
      INSERT INTO public.user_profiles (id, email, full_name, role)
      SELECT %L, 'rhsalisu@gmail.com', 'rhsalisu', 'super_admin'::public.user_role
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_profiles WHERE email = 'rhsalisu@gmail.com'
      )
    $sql$,
    rhsalisu_uuid
  );

  -- Update existing profile if role is not already super_admin
  EXECUTE $sql$
    UPDATE public.user_profiles
    SET role = 'super_admin'::public.user_role,
        full_name = 'rhsalisu',
        updated_at = now()
    WHERE email = 'rhsalisu@gmail.com'
      AND role::TEXT != 'super_admin'
  $sql$;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'super_admin user insertion failed: %', SQLERRM;
END $$;
