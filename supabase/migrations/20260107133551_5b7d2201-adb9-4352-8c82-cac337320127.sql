-- Create PEP settings table for HR admin configuration
CREATE TABLE public.pep_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by TEXT
);

-- Enable RLS
ALTER TABLE public.pep_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (needed for TeamStatus)
CREATE POLICY "Anyone can read PEP settings"
  ON public.pep_settings
  FOR SELECT
  USING (true);

-- Allow authenticated users to update (passcode protection is in the app)
CREATE POLICY "Authenticated users can update PEP settings"
  ON public.pep_settings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert PEP settings"
  ON public.pep_settings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default settings
INSERT INTO public.pep_settings (setting_key, setting_value) VALUES
  ('assessment_dates', '{"open_date": "2026-01-01", "close_date": "2026-01-31", "period_start": "2025-01-01", "period_end": "2025-12-31"}');

-- Create trigger for updated_at
CREATE TRIGGER update_pep_settings_updated_at
  BEFORE UPDATE ON public.pep_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();