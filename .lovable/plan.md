
# Authentication System Repair Plan

## Summary
The authentication system is mostly functional but had a deployment gap. I've already deployed the edge function, which should resolve the "network error" you were seeing. However, there are a few remaining improvements needed to ensure robust authentication.

## Issues Found

1. **Edge Function Was Not Deployed**: The `employee-auth` edge function wasn't deployed, causing network errors. I've already redeployed it and confirmed it's working.

2. **User `since@buntingmagnetics.com` Already Has a Custom Password**: This user previously set their password (badge_pin_is_default = false), so `1Bunting!` won't work. They need a password reset.

3. **CORS Headers Could Be More Comprehensive**: The current CORS headers don't include all the headers that Supabase client might send, which could cause issues on some browsers.

## Implementation Steps

### Step 1: Update CORS Headers in Edge Function
Expand the `Access-Control-Allow-Headers` to include all Supabase client headers:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

### Step 2: Reset Password for `since@buntingmagnetics.com`
Execute a database migration to clear their password hash so they can log in with the default:

```sql
UPDATE employees 
SET badge_pin_hash = NULL, 
    badge_pin_is_default = true, 
    badge_pin_attempts = 0,
    badge_pin_locked_until = NULL
WHERE user_email_ci = 'since@buntingmagnetics.com';
```

### Step 3: Redeploy Edge Function
Deploy the updated `employee-auth` function with the improved CORS headers.

## Technical Details

### Files to Modify:
- `supabase/functions/employee-auth/index.ts` - Update CORS headers (line 4-7)

### Database Change:
- Reset password for specific user in `employees` table

### Deployment:
- Redeploy `employee-auth` edge function

## Current Status
- Edge function is now deployed and responding correctly
- Authentication flow is working (verified via browser test)
- Login attempts are being properly validated against the database

## After Implementation
Users will be able to:
1. Log in with their email and password (either custom or default `1Bunting!`)
2. Set a new password if using the default password for the first time
3. Access protected routes once authenticated
