-- Drop the existing policy
DROP POLICY IF EXISTS "Employees can update own draft or reopened evaluations" ON public.pep_evaluations;

-- Create new policy with proper WITH CHECK clause
CREATE POLICY "Employees can update own draft or reopened evaluations" 
ON public.pep_evaluations 
FOR UPDATE 
USING (
  -- Can update if: own evaluation in draft/reopened status OR manager viewing subordinate's evaluation
  ((employee_id = get_current_employee_id()) AND (status = ANY (ARRAY['draft'::text, 'reopened'::text])))
  OR (is_in_management_chain(get_current_employee_id(), employee_id) AND (employee_id <> get_current_employee_id()))
)
WITH CHECK (
  -- Allow the row to be updated to: draft, reopened, or submitted (for employee), or any status change for managers
  ((employee_id = get_current_employee_id()) AND (status = ANY (ARRAY['draft'::text, 'reopened'::text, 'submitted'::text])))
  OR (is_in_management_chain(get_current_employee_id(), employee_id) AND (employee_id <> get_current_employee_id()))
);