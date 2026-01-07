# Authentication Architecture

This document explains how BuntingGPT webapps authenticate with the parent domain.

## Overview

The webapp uses a dual authentication strategy:

1. **Cross-subdomain Cookie SSO** - Primary method for direct access
2. **PostMessage Token Exchange** - For embedded iframe scenarios

Both methods use Supabase Auth with Microsoft Azure as the OAuth provider.

## Authentication Flow

### Scenario A: Direct Access (e.g., self.buntinggpt.com)

1. Check for `.buntinggpt.com` cookie (SSO)
2. If cookie exists → Session restored automatically
3. If no cookie → Redirect to `https://buntinggpt.com/login?redirect=<return_url>`

### Scenario B: Embedded in BuntingGPT (iframe within buntinggpt.com)

1. Child app sends `REQUEST_TOKEN` message to parent
2. Parent responds with `BUNTINGGPT_AUTH_TOKEN` containing tokens
3. Child calls `supabase.auth.setSession()` with received tokens
4. RLS context validated via `getUser()`

## Key Components

### 1. Supabase Client (`src/integrations/supabase/client.ts`)

Configures authentication storage based on the domain:

```typescript
// Production: Uses cookie storage for cross-subdomain SSO
// Development: Uses localStorage

const cookieStorage = {
  getItem: (key) => { /* Read from document.cookie */ },
  setItem: (key, value) => {
    // Cookie settings for SSO:
    // - domain: .buntinggpt.com (note leading dot)
    // - max-age: 7 days
    // - SameSite: Lax
    // - Secure: true (production only)
  },
  removeItem: (key) => { /* Delete cookie */ }
};

export const supabase = createClient(URL, KEY, {
  auth: {
    storage: isProductionDomain ? cookieStorage : window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'pkce',
  }
});
```

### 2. AuthContext (`src/contexts/AuthContext.tsx`)

Central authentication state management:

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isEmbedded: boolean;       // true if in BuntingGPT iframe
  authSource: 'cookie' | 'postMessage' | null;
}
```

**Initialization Flow:**
1. Set up `onAuthStateChange` listener
2. Check for existing cookie session via `getSession()`
3. If embedded and no cookie → listen for postMessage from parent
4. Request auth from parent with `REQUEST_TOKEN` message
5. 5-second timeout if no response

### 3. PrivateRoute (`src/components/PrivateRoute.tsx`)

Route protection with environment-aware behavior:

| State | Production | Development |
|-------|------------|-------------|
| Loading | Spinner | Spinner |
| No User | Redirect to buntinggpt.com | Show dev info + link |
| Authenticated | Render children | Render children |
| Embedded (iframe) | Spinner + "Waiting for parent..." | Same |

## PostMessage Protocol

### Messages FROM Child → Parent (BuntingGPT)

```typescript
// Request auth token
{ type: 'REQUEST_TOKEN', origin: string, timestamp: number }

// Request user info (optional)
{ type: 'REQUEST_USER', origin: string, timestamp: number }
```

### Messages FROM Parent → Child

```typescript
// Provide auth tokens (primary format)
{ 
  type: 'BUNTINGGPT_AUTH_TOKEN',
  accessToken: string,    // Supabase access_token
  refreshToken: string    // Supabase refresh_token
}

// Legacy format (still supported)
{
  type: 'PROVIDE_TOKEN',
  access_token: string,
  refresh_token: string
}
```

### Origin Validation

Only messages from trusted origins are processed:
- `https://buntinggpt.com`
- `https://*.buntinggpt.com`

## Security Considerations

1. **Cookie Security**: All auth cookies use `Secure`, `HttpOnly` (where possible), and `SameSite=Lax`
2. **Origin Validation**: PostMessage handlers validate event.origin
3. **Token Validation**: After `setSession()`, always validate RLS context with `getUser()`
4. **PKCE Flow**: OAuth uses PKCE for added security

## Troubleshooting

### Session Not Persisting
- Check cookie domain matches `.buntinggpt.com`
- Verify `Secure` flag in production
- Check for cookie size limits (chunking may be needed)

### Embedded App Not Authenticating
- Verify parent origin is sending tokens
- Check browser console for postMessage errors
- Ensure `X-Frame-Options` allows embedding

### RLS Errors After Auth
- Session may be set but user context not yet available
- Always await `getUser()` after `setSession()`
