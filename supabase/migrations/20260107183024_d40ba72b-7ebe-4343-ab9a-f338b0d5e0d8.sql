-- Version 1.1.0: HR Admin access control, enhanced POKE button, collapsible hierarchies
-- Set previous version as not current
UPDATE app_revisions 
SET is_current = false 
WHERE app_id = '02ca319b-a7d0-4a5e-a8b6-b3b2df294072' 
  AND is_current = true;

-- Insert new version
INSERT INTO app_revisions (app_id, version, major, minor, patch, revision_type, description, is_current)
VALUES (
  '02ca319b-a7d0-4a5e-a8b6-b3b2df294072',
  '1.1.0', 
  1, 
  1, 
  0, 
  'MINOR',
  'Added HR Admin access control via hr_admin_users table. POKE Team button now visible throughout assessment period with standard/urgent email templates based on days until due. HR Administration card added to Dashboard for authorized users only. Collapsible hierarchical team views for managers and HR admins.',
  true
);