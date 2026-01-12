# BuntingGPT Subdomain App Authentication Templates

These files enable subdomain apps (*.buntinggpt.com) to receive authentication 
from the parent buntinggpt.com app when embedded as iframes.

## Quick Setup

1. **Copy these files to your subdomain project:**

   ```
   useParentAuth.ts  →  src/hooks/useParentAuth.ts
   PrivateRoute.tsx  →  src/components/PrivateRoute.tsx
   AuthContext.tsx   →  src/contexts/AuthContext.tsx
   ```

2. **Wrap your app with AuthProvider** in `main.tsx` or `App.tsx`:

   ```tsx
   import { AuthProvider } from '@/contexts/AuthContext';
   
   <AuthProvider>
     <App />
   </AuthProvider>
   ```

3. **Protect routes with PrivateRoute**:

   ```tsx
   <Route path="/dashboard" element={
     <PrivateRoute>
       <Dashboard />
     </PrivateRoute>
   } />
   ```

## How It Works

### When Embedded (in iframe on buntinggpt.com)

1. `useParentAuth` detects iframe context (`window.self !== window.top`)
2. Sends `BUNTINGGPT_AUTH_REQUEST` message to parent
3. Parent responds with `BUNTINGGPT_AUTH_TOKEN` containing tokens
4. Hook calls `supabase.auth.setSession()` with received tokens
5. `PrivateRoute` allows access once session is established

### When Standalone (accessed directly)

1. `useParentAuth.isEmbedded` returns `false`
2. Normal Supabase auth flow is used
3. User must log in via the app's own auth page

## Message Protocol

**Request (child → parent):**
```json
{
  "type": "BUNTINGGPT_AUTH_REQUEST",
  "origin": "https://self.buntinggpt.com",
  "timestamp": 1234567890
}
```

**Response (parent → child):**
```json
{
  "type": "BUNTINGGPT_AUTH_TOKEN",
  "accessToken": "eyJ...",
  "refreshToken": "abc123...",
  "access_token": "eyJ...",
  "refresh_token": "abc123...",
  "user": { "id": "uuid", "email": "user@example.com" },
  "origin": "https://buntinggpt.com",
  "timestamp": 1234567890
}
```

## Important Notes

- **Refresh tokens are OPAQUE strings** - do NOT validate them as JWTs
- **Origin validation** - only accept messages from `*.buntinggpt.com`
- **Cookie domain** - ensure Supabase client uses `.buntinggpt.com` for cookies
- **Same Supabase project** - subdomain must connect to same Supabase instance

## Troubleshooting

### "Authentication timeout"
- Parent app may not be logged in
- Check browser console for postMessage errors
- Verify origin is in ALLOWED_ORIGINS list

### "Invalid access token format"
- Token should be a JWT with 3 dot-separated parts
- Check parent app is sending correct tokens

### "Refresh token too short"
- Microsoft OAuth may not have `offline_access` scope
- Check Supabase Azure provider settings

### Session not persisting
- Verify cookie domain is set to `.buntinggpt.com`
- Check browser privacy settings (third-party cookies)
