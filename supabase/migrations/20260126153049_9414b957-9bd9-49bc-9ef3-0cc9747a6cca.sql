-- Reset ALL employee passwords to require the default 1Bunting! password
-- Setting hash to NULL means they must use the default password on first login
UPDATE employees 
SET 
  badge_pin_hash = NULL,
  badge_pin_is_default = true,
  badge_pin_attempts = 0,
  badge_pin_locked_until = NULL
WHERE is_active = true;