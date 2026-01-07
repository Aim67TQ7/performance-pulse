-- Add Robert Clausing to HR Admin users
INSERT INTO public.hr_admin_users (employee_id, granted_by)
VALUES ('c8160fac-3f82-42bb-9ab2-8f5d4f900921', 'Manual addition')
ON CONFLICT (employee_id) DO NOTHING;