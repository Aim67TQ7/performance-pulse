

## Hybrid Authentication: SSO + Badge/PIN Login

### Overview

You need a **hybrid authentication system** that supports:
1. **Microsoft SSO** via gate.buntinggpt.com (existing flow for most users)
2. **Badge + PIN login** for users who can't use Microsoft OAuth

The app will show a `/login` page with both options, and admins will manage PINs (users won't set their own).

---

### Current State

| Component | Status |
|-----------|--------|
| `employee-auth` edge function | Has `/login` endpoint that works with email+password, but needs badge support |
| `AuthContext.tsx` | SSO-only (redirects to gate) |
| `AuthContext.legacy.tsx` | Email+password with localStorage - can be adapted |
| Database | `employees` table has `badge_number`, `badge_pin_hash`, `badge_pin_attempts`, `badge_pin_locked_until` columns |
| Login page | Deleted - needs to be recreated |

---

### Changes Required

#### 1. Update Edge Function: Add Badge Login Endpoint

Add a new `/badge-login` endpoint to `employee-auth/index.ts` that:
- Accepts `badge_number` + `pin` (instead of email + password)
- Looks up employee by `badge_number`
- Verifies the PIN against `badge_pin_hash`
- Returns JWT token and employee data on success

#### 2. Create New AuthContext with Hybrid Support

Replace `src/contexts/AuthContext.tsx` with a new version that:
- Supports both SSO (via gate cookies) AND badge login (via localStorage)
- Adds `loginWithBadge(badgeNumber, pin)` method
- Keeps SSO session detection for users who come from gate
- Uses localStorage for badge-authenticated users

#### 3. Create Login Page

Create `src/pages/Login.tsx` with:
- **SSO button**: "Sign in with Microsoft" → redirects to gate.buntinggpt.com
- **Badge login form**: Badge number + PIN fields
- Clean, branded UI matching the app's dark theme

#### 4. Update ProtectedRoute

Modify `src/components/ProtectedRoute.tsx` to:
- Show the `/login` page (not auto-redirect to gate)
- Use React Router navigation instead of `window.location.href`

#### 5. Update App.tsx

Add the `/login` route back to the router.

---

### Authentication Flow Diagram

```text
User visits protected route
            │
            ▼
    ProtectedRoute checks
    isAuthenticated
            │
    ┌───────┴───────┐
    │               │
  Yes (has        No
  valid session)    │
    │               ▼
    ▼         Navigate to /login
  Render            │
  Content           ▼
            ┌───────────────────┐
            │   Login Page      │
            │                   │
            │  [SSO Button]     │──► gate.buntinggpt.com
            │       OR          │      (Microsoft OAuth)
            │  [Badge + PIN]    │──► /employee-auth/badge-login
            └───────────────────┘
                    │
                    ▼ (on success)
            Store token + redirect
            to Dashboard
```

---

### Technical Details

#### Edge Function: `/badge-login` Endpoint

```text
POST /employee-auth/badge-login
Body: { badge_number: "12345", pin: "1234" }

Response (success):
{
  token: "jwt...",
  employee: { id, name_first, name_last, ... }
}

Response (failure):
{
  error: "Invalid badge number or PIN",
  remaining_attempts: 3
}
```

The endpoint will:
- Look up employee by `badge_number` (case-insensitive)
- Check for lockout (`badge_pin_locked_until`)
- Verify PIN against `badge_pin_hash`
- Track failed attempts and lock after 5 failures
- Return JWT on success

#### AuthContext State Management

| Auth Method | Token Storage | Session Detection |
|-------------|--------------|-------------------|
| SSO (gate) | `bunting-auth-token` cookie | Check cookie + call `/sso-verify` |
| Badge login | `localStorage` (`pep_auth_token`) | Check localStorage + call `/verify-token` |

The context will check both sources on initialization.

#### Login Page UI

- Dark theme (`bg-[#1A1A2E]`) matching the app
- BuntingGPT branding at top
- Two options:
  1. "Sign in with Microsoft" button (full-width, blue)
  2. Divider with "or sign in with your badge"
  3. Badge number input + PIN input + Submit button
- Error messages for invalid credentials
- Loading states during authentication

---

### Files to Modify/Create

| File | Action |
|------|--------|
| `supabase/functions/employee-auth/index.ts` | Add `/badge-login` endpoint |
| `src/contexts/AuthContext.tsx` | Rewrite for hybrid SSO + badge auth |
| `src/pages/Login.tsx` | Create new login page |
| `src/components/ProtectedRoute.tsx` | Navigate to /login instead of gate redirect |
| `src/App.tsx` | Add `/login` route |

---

### Admin PIN Management

Since you chose "Admin-only passwords", the existing admin endpoints already support this:
- `/admin/set-default-passwords` - Set a default PIN for all employees
- `/admin/reset-employee-password` - Reset a specific employee's PIN

The HR Admin page can use these endpoints to manage PINs. No self-service password setup is needed.

