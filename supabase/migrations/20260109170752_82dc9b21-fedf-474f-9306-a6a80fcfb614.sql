-- Create pep_competencies table for configurable performance competencies
CREATE TABLE public.pep_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  observable_behaviors TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pep_competencies ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read competencies
CREATE POLICY "Anyone can read competencies"
ON public.pep_competencies
FOR SELECT
USING (true);

-- HR admins can manage competencies (using pep_settings pattern - passcode auth)
CREATE POLICY "Authenticated users can insert competencies"
ON public.pep_competencies
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update competencies"
ON public.pep_competencies
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete competencies"
ON public.pep_competencies
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create updated_at trigger
CREATE TRIGGER update_pep_competencies_updated_at
BEFORE UPDATE ON public.pep_competencies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with initial competencies
INSERT INTO public.pep_competencies (name, definition, observable_behaviors, display_order) VALUES
('Teamwork and Collaboration', 'Works effectively with others to achieve shared goals and foster a positive team environment.', 'Communicates clearly; supports others; contributes to team success; builds trust; resolves conflict constructively.', 1),
('Attitude', 'Demonstrates professionalism, positivity, and emotional maturity in all work interactions.', 'Accepts feedback; remains respectful; adapts to change; maintains composure; demonstrates resilience.', 2),
('Quality of Work', 'Produces accurate, thorough, and dependable work that meets performance standards.', 'Follows standards; minimizes errors; delivers complete work; pays attention to detail; ensures reliability.', 3),
('Accountability and Ownership', 'Takes responsibility for commitments, actions, and results.', 'Meets deadlines; takes initiative; addresses issues; follows through; accepts responsibility for outcomes.', 4),
('Innovation and Continuous Improvement', 'Seeks and implements improvements that increase efficiency and effectiveness.', 'Suggests ideas; questions inefficiencies; improves processes; adapts to change; supports improvement efforts.', 5),
('Employee Development', 'Actively works to grow skills, knowledge, and professional capability.', 'Seeks learning; applies feedback; supports others; pursues training; develops capabilities.', 6);