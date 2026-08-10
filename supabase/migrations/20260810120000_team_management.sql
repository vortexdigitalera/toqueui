-- ============================================================
-- Migration: Team Management — admin-only operations
-- ============================================================

-- Add suspended_at column to user_profiles for suspend/reactivate
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT DEFAULT NULL;

-- Add permissions JSONB column for fine-grained panel permissions
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Helper: check if user is suspended
CREATE OR REPLACE FUNCTION public.is_suspended(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT suspended_at IS NOT NULL FROM public.user_profiles WHERE id = target_user_id LIMIT 1;
$$;

-- Admin-only RLS: admins can update any profile (for role changes, suspend, permissions)
DROP POLICY IF EXISTS "admins_update_all_profiles" ON public.user_profiles;
CREATE POLICY "admins_update_all_profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Admin-only RLS: admins can insert new profiles (for creating operator accounts)
DROP POLICY IF EXISTS "admins_insert_profiles" ON public.user_profiles;
CREATE POLICY "admins_insert_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());
