-- Create hr_admin_users table for authorized HR Admin access
CREATE TABLE public.hr_admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  granted_at timestamptz DEFAULT now(),
  granted_by text,
  UNIQUE(employee_id)
);

-- Enable RLS
ALTER TABLE public.hr_admin_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to check HR admin status
CREATE POLICY "Authenticated users can check HR admin status"
  ON public.hr_admin_users FOR SELECT
  TO authenticated
  USING (true);

-- Seed initial authorized users (6 total)
INSERT INTO public.hr_admin_users (employee_id, granted_by) VALUES
  ('096e7128-b624-40bb-a267-ecbfbcfa8e98', 'Initial setup'), -- Robert Bunting
  ('4cdfa83e-79db-41ba-8a48-5166ba8c440b', 'Initial setup'), -- April Ahlers
  ('fac9289c-5f59-46f8-be16-744e0503cb01', 'Initial setup'), -- Candace Vogt
  ('1f2db095-89bd-4893-8fe0-c709f2aea33b', 'Initial setup'), -- Seth Beytien
  ('796b3cdd-5ce6-4140-8053-7be3fa9ae484', 'Initial setup'), -- Mark Friesen
  ('37df56e3-d3ed-43b7-a91b-66f9590a3f6d', 'Initial setup'); -- Matthew Markus