-- Create pep_evaluations table
CREATE TABLE public.pep_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'signed', 'reopened')),
  
  -- JSON data fields
  employee_info_json JSONB,
  quantitative_json JSONB,
  qualitative_json JSONB,
  summary_json JSONB,
  
  -- PDF storage
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  
  -- Workflow tracking
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.employees(id),
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES public.employees(id),
  reopen_reason TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(employee_id, period_year)
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_pep_evaluations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pep_evaluations_updated_at
  BEFORE UPDATE ON public.pep_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pep_evaluations_updated_at();

-- Security definer function to check management chain
CREATE OR REPLACE FUNCTION public.is_in_management_chain(
  _viewer_employee_id UUID, 
  _target_employee_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_id UUID := _target_employee_id;
  max_depth INT := 10;
  depth INT := 0;
BEGIN
  -- Check if viewer is the target (self)
  IF _viewer_employee_id = _target_employee_id THEN
    RETURN TRUE;
  END IF;
  
  -- Walk up the management chain
  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    SELECT reports_to INTO current_id FROM employees WHERE id = current_id;
    IF current_id = _viewer_employee_id THEN
      RETURN TRUE;
    END IF;
    depth := depth + 1;
  END LOOP;
  RETURN FALSE;
END;
$$;

-- Security definer function to get employee_id for current user
CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Enable RLS
ALTER TABLE public.pep_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: Employee can view their own; managers in chain can view submitted evaluations
CREATE POLICY "Employees can view own evaluations"
  ON public.pep_evaluations
  FOR SELECT
  USING (
    employee_id = public.get_current_employee_id()
    OR (
      status IN ('submitted', 'reviewed', 'signed')
      AND public.is_in_management_chain(public.get_current_employee_id(), employee_id)
    )
  );

-- INSERT: Employee can create their own evaluation
CREATE POLICY "Employees can create own evaluations"
  ON public.pep_evaluations
  FOR INSERT
  WITH CHECK (employee_id = public.get_current_employee_id());

-- UPDATE: Employee can update draft/reopened; manager can update status
CREATE POLICY "Employees can update own draft or reopened evaluations"
  ON public.pep_evaluations
  FOR UPDATE
  USING (
    (employee_id = public.get_current_employee_id() AND status IN ('draft', 'reopened'))
    OR (
      public.is_in_management_chain(public.get_current_employee_id(), employee_id)
      AND employee_id != public.get_current_employee_id()
    )
  );

-- DELETE: Only employee can delete their draft
CREATE POLICY "Employees can delete own draft evaluations"
  ON public.pep_evaluations
  FOR DELETE
  USING (employee_id = public.get_current_employee_id() AND status = 'draft');

-- Create index for performance
CREATE INDEX idx_pep_evaluations_employee_id ON public.pep_evaluations(employee_id);
CREATE INDEX idx_pep_evaluations_status ON public.pep_evaluations(status);