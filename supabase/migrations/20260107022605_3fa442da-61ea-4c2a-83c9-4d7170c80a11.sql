-- Create app_revisions table with app_id for multi-app support
CREATE TABLE public.app_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.app_items(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  major INTEGER NOT NULL,
  minor INTEGER NOT NULL,
  patch INTEGER NOT NULL,
  revision_type TEXT NOT NULL CHECK (revision_type IN ('MAJOR', 'MINOR', 'PATCH')),
  description TEXT NOT NULL,
  release_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_current BOOLEAN NOT NULL DEFAULT false,
  released_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(app_id, version)
);

-- Ensure only ONE current version PER APP
CREATE UNIQUE INDEX idx_app_revisions_current_per_app 
ON public.app_revisions (app_id) 
WHERE is_current = true;

-- Index for version lookups by app
CREATE INDEX idx_app_revisions_app_version 
ON public.app_revisions (app_id, major DESC, minor DESC, patch DESC);

-- Enable RLS
ALTER TABLE public.app_revisions ENABLE ROW LEVEL SECURITY;

-- Everyone can read revisions (public visibility per REVISIONINGRULES.md)
CREATE POLICY "Anyone can view revisions" 
ON public.app_revisions 
FOR SELECT 
USING (true);

-- Only admins can manage revisions (using existing has_user_role function)
CREATE POLICY "Admins can manage revisions" 
ON public.app_revisions 
FOR ALL 
USING (has_user_role(auth.uid(), 'admin')) 
WITH CHECK (has_user_role(auth.uid(), 'admin'));

-- Seed initial version for Prospector (existing app with revisions)
INSERT INTO public.app_revisions (
  app_id, version, major, minor, patch, 
  revision_type, description, is_current
) VALUES (
  '2a0d5058-eb46-4ecc-af8c-d5ec2df8cd7b',
  '1.0.0', 1, 0, 0, 'MAJOR',
  'Initial release of Bunting Magnetics Customer & Prospects Map',
  true
);

-- Seed initial version for Performance Self-Review
INSERT INTO public.app_revisions (
  app_id, version, major, minor, patch,
  revision_type, description, is_current
) VALUES (
  '02ca319b-a7d0-4a5e-a8b6-b3b2df294072',
  '1.0.0', 1, 0, 0, 'MAJOR',
  'Initial release of Performance Self-Evaluation',
  true
);