-- Create a security definer function to check if user is HR admin
CREATE OR REPLACE FUNCTION public.is_hr_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hr_admin_users hau
    JOIN public.employees e ON e.id = hau.employee_id
    WHERE e.user_id = _user_id
  )
$$;

-- Policy: HR admins can view all employees
CREATE POLICY "HR admins can view all employees"
ON public.employees
FOR SELECT
TO authenticated
USING (public.is_hr_admin(auth.uid()));

-- Policy: HR admins can insert employees
CREATE POLICY "HR admins can insert employees"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (public.is_hr_admin(auth.uid()));

-- Policy: HR admins can update employees
CREATE POLICY "HR admins can update employees"
ON public.employees
FOR UPDATE
TO authenticated
USING (public.is_hr_admin(auth.uid()))
WITH CHECK (public.is_hr_admin(auth.uid()));

-- Policy: HR admins can delete employees
CREATE POLICY "HR admins can delete employees"
ON public.employees
FOR DELETE
TO authenticated
USING (public.is_hr_admin(auth.uid()));