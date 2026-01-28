
# Add Individual Password Reset to Employee Manager

## Summary
Add a "Reset Password" button to the Employee Management table in HR Administration. When clicked, it will reset the selected employee's password to the default `1Bunting!`, forcing them to set a new password on their next login.

## What You'll See
- A new "Reset Password" button (key icon) appears in each employee row in the Employee Management table
- Clicking the button shows a confirmation dialog with the employee's name
- After confirmation, the password is reset and a success message appears
- The employee can then log in with `1Bunting!` and will be prompted to create a new password

## Implementation Details

### 1. Add New Endpoint to manage-employees Edge Function
Create a new `/reset-password` action that uses JWT authentication (like the existing create/update/delete actions) instead of requiring the service role key:

**File:** `supabase/functions/manage-employees/index.ts`

```typescript
if (action === 'reset-password' && req.method === 'POST') {
  const { employee_id } = await req.json();
  
  // Clear the password hash and set to default state
  const { error } = await supabase
    .from('employees')
    .update({
      badge_pin_hash: null,
      badge_pin_is_default: true,
      badge_pin_attempts: 0,
      badge_pin_locked_until: null
    })
    .eq('id', employee_id);
    
  // Return success/error response
}
```

### 2. Update EmployeeManager Component
Add a reset password button and confirmation dialog:

**File:** `src/components/admin/EmployeeManager.tsx`

- Add state for reset confirmation dialog
- Add `handleResetPassword` function to call the edge function
- Add Key icon button in each table row
- Add confirmation dialog with employee name

### Files Modified
1. `supabase/functions/manage-employees/index.ts` - Add reset-password endpoint
2. `src/components/admin/EmployeeManager.tsx` - Add UI for password reset

### Security
- Uses existing JWT verification (same as create/update/delete)
- Only HR admins with valid tokens can access
- Clears password hash instead of setting one (employee logs in with default `1Bunting!` and sets their own)
