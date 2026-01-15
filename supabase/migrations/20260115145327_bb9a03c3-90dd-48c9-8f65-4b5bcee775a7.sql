-- Add is_hr_admin column to employees table
ALTER TABLE public.employees 
ADD COLUMN is_hr_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Set is_hr_admin = true for existing HR admin users
UPDATE public.employees e
SET is_hr_admin = TRUE
WHERE e.id IN (
  SELECT employee_id FROM public.hr_admin_users
);