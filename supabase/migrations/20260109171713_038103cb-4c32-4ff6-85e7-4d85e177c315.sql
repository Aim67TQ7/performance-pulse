-- Add hr_admin_auth_mode setting to pep_settings table
INSERT INTO pep_settings (setting_key, setting_value)
VALUES ('hr_admin_auth_mode', '{"require_auth": false}')
ON CONFLICT (setting_key) DO NOTHING;