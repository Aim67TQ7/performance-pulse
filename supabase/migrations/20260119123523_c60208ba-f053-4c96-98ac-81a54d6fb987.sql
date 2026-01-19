-- Update the is_hr_admin function to use the is_hr_admin column on employees table
-- This aligns with the new SSO-based auth system that uses email-based employee lookup

CREATE OR REPLACE FUNCTION public.is_hr_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE user_id = _user_id
      AND is_hr_admin = true
      AND is_active = true
  )
$$;