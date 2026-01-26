-- Reset badge login lockout for Robert Clausing
UPDATE employees 
SET badge_pin_attempts = 0, 
    badge_pin_locked_until = NULL 
WHERE id = 'c8160fac-3f82-42bb-9ab2-8f5d4f900921';