-- ============================================================
-- Migration: Reset password for rhsalisu@gmail.com
-- ============================================================
-- Sets a known bcrypt password hash for the user so they can
-- sign in with email+password via signInWithPassword.
-- Also ensures email_confirmed_at is set (required for login)
-- and that raw_app_meta_data has the correct provider info.
-- ============================================================

DO $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get the user id for rhsalisu@gmail.com
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'rhsalisu@gmail.com'
  LIMIT 1;

  IF target_user_id IS NULL THEN
    -- User does not exist yet — create them fresh
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_user_meta_data,
      raw_app_meta_data,
      is_sso_user,
      is_anonymous,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      email_change_token_current,
      email_change_confirm_status,
      reauthentication_token,
      reauthentication_sent_at,
      phone,
      phone_change,
      phone_change_token,
      phone_change_sent_at
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'rhsalisu@gmail.com',
      crypt('Admin@2024!', gen_salt('bf', 10)),
      now(),
      now(),
      now(),
      jsonb_build_object('full_name', 'RH Salisu', 'role', 'admin'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false,
      false,
      '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    );

    -- Fetch the newly created id
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'rhsalisu@gmail.com'
    LIMIT 1;

    -- Ensure identity row exists for the new user
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      target_user_id,
      target_user_id::text,
      'email',
      jsonb_build_object(
        'sub',            target_user_id::text,
        'email',          'rhsalisu@gmail.com',
        'email_verified', true,
        'provider',       'email'
      ),
      now(),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;

    -- Ensure user_profile row exists
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (target_user_id, 'rhsalisu@gmail.com', 'RH Salisu', 'admin')
    ON CONFLICT (id) DO UPDATE
      SET role = 'admin',
          updated_at = now();

    RAISE NOTICE 'Created new user rhsalisu@gmail.com with id %', target_user_id;

  ELSE
    -- User exists — reset their password and ensure account is confirmed
    UPDATE auth.users
    SET
      encrypted_password        = crypt('Admin@2024!', gen_salt('bf', 10)),
      email_confirmed_at        = COALESCE(email_confirmed_at, now()),
      updated_at                = now(),
      raw_app_meta_data         = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      banned_until              = NULL,
      confirmation_token        = '',
      recovery_token            = '',
      reauthentication_token    = ''
    WHERE id = target_user_id;

    -- Ensure identity row exists (in case it was missing)
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      target_user_id,
      target_user_id::text,
      'email',
      jsonb_build_object(
        'sub',            target_user_id::text,
        'email',          'rhsalisu@gmail.com',
        'email_verified', true,
        'provider',       'email'
      ),
      now(),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;

    -- Ensure user_profile row exists and has admin role
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (target_user_id, 'rhsalisu@gmail.com', 'RH Salisu', 'admin')
    ON CONFLICT (id) DO UPDATE
      SET role = 'admin',
          updated_at = now();

    RAISE NOTICE 'Reset password for existing user rhsalisu@gmail.com (id: %)', target_user_id;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Password reset migration failed: %', SQLERRM;
END $$;
