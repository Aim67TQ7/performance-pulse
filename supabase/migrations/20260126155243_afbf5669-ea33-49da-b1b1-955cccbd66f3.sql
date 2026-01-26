UPDATE employees 
SET badge_pin_hash = NULL, 
    badge_pin_is_default = true, 
    badge_pin_attempts = 0,
    badge_pin_locked_until = NULL
WHERE user_email_ci = 'since@buntingmagnetics.com';