# Subdomain Authentication Guide

> **For:** Subdomain apps (e.g., `self.buntinggpt.com`) embedded in parent `buntinggpt.com`

---

## Quick Start

### Step 1: Copy These 4 Files

Copy from the parent app to your subdomain app:

| Source (Parent App) | Destination (Your App) |
|---------------------|------------------------|
| `src/integrations/supabase/client.ts` | `src/integrations/supabase/client.ts` |
| `docs/subdomain-auth-templates/useParentAuth.ts` | `src/hooks/useParentAuth.ts` |
| `docs/subdomain-auth-templates/AuthContext.tsx` | `src/contexts/AuthContext.tsx` |
| `docs/subdomain-auth-templates/PrivateRoute.tsx` | `src/components/PrivateRoute.tsx` |

### Step 2: Wrap Your App

```tsx
// src/App.tsx or src/main.tsx
import { AuthProvider } from '@/contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      {/* Your app content */}
    </AuthProvider>
  );
}
```

### Step 3: Protect Routes

```tsx
import { PrivateRoute } from '@/components/PrivateRoute';

// In your router
<Route path="/dashboard" element={
  <PrivateRoute>
    <Dashboard />
  </PrivateRoute>
} />
```

### Step 4: Test

1. Load your app in the parent iframe at `buntinggpt.com`
2. Open browser console
3. Look for: `[useParentAuth] Auth received from parent ✓`
4. Verify no redirect to `/auth` page

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  Parent App (buntinggpt.com)                                    │
│                                                                 │
│  1. User logs in → Supabase session established                 │
│  2. User opens app → navigates to /iframe?url=self.buntinggpt.com│
│  3. Iframe loads → parent sends AUTH_TOKEN message              │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Subdomain App (self.buntinggpt.com) - IFRAME             │  │
│  │                                                           │  │
│  │  4. useParentAuth listens for AUTH_TOKEN                  │  │
│  │  5. Validates origin is *.buntinggpt.com                  │  │
│  │  6. Calls supabase.auth.setSession(tokens)                │  │
│  │  7. App renders authenticated content                     │  │
│  │                                                           │  │
│  │  If no token received after 2s:                           │  │
│  │  → Sends REQUEST_AUTH to parent                           │  │
│  │  → Parent responds with AUTH_TOKEN                        │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Message Protocol

### Parent → Subdomain

The parent sends this message when the iframe loads:

```typescript
{
  type: 'AUTH_TOKEN',
  token: string,        // Supabase access_token (JWT - 3 parts, dot-separated)
  refreshToken: string, // Supabase refresh_token (OPAQUE STRING - NOT a JWT!)
  user: {
    id: string,
    email: string
  }
}
```

### Subdomain → Parent

Your app can request auth if not received:

```typescript
// Always use explicit origin, never '*'
window.parent.postMessage({ type: 'REQUEST_AUTH' }, 'https://buntinggpt.com');
```

**Supported message types (for backwards compatibility):**
- `REQUEST_AUTH` (primary)
- `BUNTINGGPT_AUTH_REQUEST` (legacy)

---

## Allowed Origins

Subdomain apps must validate message origins:

```typescript
const ALLOWED_ORIGINS = [
  'https://buntinggpt.com',
  'https://www.buntinggpt.com',
];

function isAllowedOrigin(origin: string): boolean {
  // Exact match
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // Any *.buntinggpt.com subdomain
  if (origin.endsWith('.buntinggpt.com')) return true;
  
  // Localhost for development
  if (origin.startsWith('http://localhost:')) return true;
  
  return false;
}
```

---

## Template Files

### 1. Supabase Client (`src/integrations/supabase/client.ts`)

Configures cookie-based storage for cross-subdomain session sharing:

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "your-anon-key-here";

// Detect production domain
function isProductionHost(hostname: string): boolean {
  return hostname === 'buntinggpt.com' || 
         hostname.endsWith('.buntinggpt.com');
}

const isProductionDomain = 
  typeof window !== 'undefined' && 
  isProductionHost(window.location.hostname);

// Cookie chunk size (3KB is safe margin below 4KB browser limit)
const COOKIE_CHUNK_SIZE = 3000;

// Custom cookie storage that splits large JWTs across multiple cookies
const cookieStorage = {
  getItem: (key: string): string | null => {
    try {
      const cookies = document.cookie.split('; ');
      const chunks: { index: number; value: string }[] = [];
      
      for (const cookie of cookies) {
        const [cookieKey, ...valueParts] = cookie.split('=');
        const cookieValue = valueParts.join('=');
        
        if (cookieKey.startsWith(`${key}_chunk_`)) {
          const indexStr = cookieKey.substring(`${key}_chunk_`.length);
          const index = parseInt(indexStr, 10);
          if (!isNaN(index)) {
            chunks.push({ index, value: decodeURIComponent(cookieValue) });
          }
        }
      }
      
      if (chunks.length === 0) return null;
      chunks.sort((a, b) => a.index - b.index);
      return chunks.map(c => c.value).join('') || null;
    } catch (e) {
      console.error('Cookie read error:', e);
      return null;
    }
  },
  
  setItem: (key: string, value: string): void => {
    try {
      cookieStorage.removeItem(key);
      
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += COOKIE_CHUNK_SIZE) {
        chunks.push(value.substring(i, i + COOKIE_CHUNK_SIZE));
      }
      
      const maxAge = 60 * 60 * 24 * 7; // 7 days
      
      chunks.forEach((chunk, index) => {
        const chunkKey = `${key}_chunk_${index}`;
        const encodedChunk = encodeURIComponent(chunk);
        // CRITICAL: domain=.buntinggpt.com (leading dot) for cross-subdomain sharing
        document.cookie = `${chunkKey}=${encodedChunk}; path=/; domain=.buntinggpt.com; max-age=${maxAge}; SameSite=Lax; Secure`;
      });
    } catch (e) {
      console.error('Cookie write error:', e);
    }
  },
  
  removeItem: (key: string): void => {
    try {
      const cookies = document.cookie.split('; ');
      for (const cookie of cookies) {
        const [cookieKey] = cookie.split('=');
        if (cookieKey.startsWith(`${key}_chunk_`)) {
          document.cookie = `${cookieKey}=; path=/; domain=.buntinggpt.com; max-age=0`;
        }
      }
    } catch (e) {
      console.error('Cookie remove error:', e);
    }
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Production uses cookies for cross-subdomain; localhost uses localStorage
    storage: isProductionDomain ? cookieStorage : window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  }
});
```

### 2. useParentAuth Hook (`src/hooks/useParentAuth.ts`)

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

// Only accept messages from buntinggpt.com domains
const isAllowedOrigin = (origin: string): boolean => {
  return origin === 'https://buntinggpt.com' || 
         origin === 'https://www.buntinggpt.com' ||
         origin.endsWith('.buntinggpt.com') ||
         origin.startsWith('http://localhost:');
};

interface ParentAuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isEmbedded: boolean;
  authReceived: boolean;
  error: string | null;
  requestAuth: () => void;
}

export const useParentAuth = (): ParentAuthState => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authReceived, setAuthReceived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

  const requestAuth = useCallback(() => {
    if (isEmbedded && window.parent) {
      console.log('[useParentAuth] Requesting auth from parent...');
      // Always use explicit origin, never '*'
      window.parent.postMessage({ type: 'REQUEST_AUTH' }, 'https://buntinggpt.com');
    }
  }, [isEmbedded]);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    if (!isAllowedOrigin(event.origin)) {
      console.log('[useParentAuth] Rejected message from:', event.origin);
      return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // Handle AUTH_TOKEN (primary) and legacy message types
    if (data.type === 'AUTH_TOKEN' || 
        data.type === 'BUNTINGGPT_AUTH_TOKEN' || 
        data.type === 'PROVIDE_TOKEN') {
      
      console.log('[useParentAuth] Received', data.type, 'from', event.origin);

      const { token, refreshToken } = data;

      // Validate tokens exist - but DON'T validate refresh token structure (it's not a JWT!)
      if (!token || token.length < 20) {
        console.error('[useParentAuth] Missing or invalid access token');
        setError('Invalid access token received');
        setIsLoading(false);
        return;
      }

      if (!refreshToken || refreshToken.length < 20) {
        console.warn('[useParentAuth] Missing or short refresh token');
        // Continue anyway - some flows may not include refresh token
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshToken || '',
        });

        if (sessionError) {
          console.error('[useParentAuth] setSession error:', sessionError);
          setError(sessionError.message);
          setIsLoading(false);
          return;
        }

        if (sessionData.session) {
          console.log('[useParentAuth] Auth received from parent ✓');
          setSession(sessionData.session);
          setUser(sessionData.session.user);
          setAuthReceived(true);
          setError(null);
        }
      } catch (err) {
        console.error('[useParentAuth] Exception setting session:', err);
        setError('Failed to establish session');
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);

    if (isEmbedded) {
      console.log('[useParentAuth] Embedded mode detected, waiting for parent auth...');
      
      // Request auth immediately
      requestAuth();

      // Retry every 2 seconds if not received
      const retryInterval = setInterval(() => {
        if (!authReceived) {
          requestAuth();
        }
      }, 2000);

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        if (!authReceived) {
          console.error('[useParentAuth] Auth timeout after 10s');
          setError('Authentication timeout - no response from parent app');
          setIsLoading(false);
        }
      }, 10000);

      return () => {
        clearInterval(retryInterval);
        clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
      };
    } else {
      // Not embedded - use normal Supabase auth
      console.log('[useParentAuth] Standalone mode, using Supabase auth');
      
      supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
        if (existingSession) {
          setSession(existingSession);
          setUser(existingSession.user);
          setAuthReceived(true);
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setAuthReceived(!!newSession);
      });

      return () => {
        subscription.unsubscribe();
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [handleMessage, isEmbedded, authReceived, requestAuth]);

  return { user, session, isLoading, isEmbedded, authReceived, error, requestAuth };
};
```

### 3. AuthContext (`src/contexts/AuthContext.tsx`)

```typescript
import { createContext, useContext, ReactNode } from 'react';
import { useParentAuth } from '@/hooks/useParentAuth';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isEmbedded: boolean;
  authReceived: boolean;
  error: string | null;
  requestAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useParentAuth();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 4. PrivateRoute (`src/components/PrivateRoute.tsx`)

```typescript
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PrivateRouteProps {
  children: ReactNode;
}

export const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { user, isLoading, isEmbedded, authReceived, error } = useAuth();

  // Show loading spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">
            {isEmbedded ? 'Waiting for authentication from parent app...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error if embedded and auth failed
  if (error && isEmbedded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-destructive">
          <p className="font-medium">Authentication Error</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <p className="text-xs text-muted-foreground mt-4">
            Please ensure you're accessing this app from buntinggpt.com
          </p>
        </div>
      </div>
    );
  }

  // No user - handle based on context
  if (!user) {
    // CRITICAL: Never redirect to /auth when embedded!
    if (isEmbedded) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">
            Authentication required. Please access from parent app.
          </p>
        </div>
      );
    }
    // Standalone mode - redirect to auth
    return <Navigate to="/auth" replace />;
  }

  // Authenticated - render children
  return <>{children}</>;
};
```

---

## Critical Rules

### 1. Refresh Token is NOT a JWT

```typescript
// ❌ WRONG - This breaks authentication!
const parts = refreshToken.split('.');
if (parts.length !== 3) {
  throw new Error('Invalid token'); // Blocks valid auth!
}

// ✅ CORRECT - Just check it exists and has reasonable length
if (!refreshToken || refreshToken.length < 20) {
  console.warn('Missing or invalid refresh token');
}
```

### 2. Never Redirect When Embedded

```typescript
// ❌ WRONG - Shows login page inside iframe
if (!user) {
  return <Navigate to="/auth" />;
}

// ✅ CORRECT - Show loading/error, let parent handle auth
if (!user) {
  if (isEmbedded) {
    return <div>Waiting for auth from parent...</div>;
  }
  return <Navigate to="/auth" />;
}
```

### 3. Cookie Domain Must Include Leading Dot

```typescript
// ❌ WRONG - Won't share across subdomains
document.cookie = `token=xxx; domain=buntinggpt.com`;

// ✅ CORRECT - Shares across all *.buntinggpt.com
document.cookie = `token=xxx; domain=.buntinggpt.com`;
```

### 4. Always Use Explicit Origin for postMessage

```typescript
// ❌ WRONG - Security risk
window.parent.postMessage({ type: 'REQUEST_AUTH' }, '*');

// ✅ CORRECT - Explicit origin
window.parent.postMessage({ type: 'REQUEST_AUTH' }, 'https://buntinggpt.com');
```

---

## Troubleshooting

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Authenticating..." forever | Parent not sending token | Check Iframe.tsx sends AUTH_TOKEN on load |
| Origin validation fails | www vs non-www mismatch | Add both to ALLOWED_ORIGINS |
| Session doesn't persist | localStorage instead of cookies | Use cookieStorage with .buntinggpt.com domain |
| "Invalid refresh token" error | Treating refresh token as JWT | Remove JWT validation for refresh tokens |
| Redirect loop to /auth | PrivateRoute redirecting when embedded | Add isEmbedded check before redirect |
| Works on localhost but not production | Different storage backends | Verify isProductionHost() returns correct value |

### Debug Script

Run this in your subdomain app's browser console:

```javascript
console.log('=== SUBDOMAIN AUTH DEBUG ===');
console.log('Hostname:', window.location.hostname);
console.log('Is embedded:', window.self !== window.top);
console.log('');

// Check cookies
const cookies = document.cookie;
console.log('Has auth cookies:', cookies.includes('_chunk_'));
console.log('');

// Check Supabase session
if (typeof supabase !== 'undefined') {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      console.log('✓ Session exists');
      console.log('  User:', session.user.email);
      console.log('  Access token length:', session.access_token.length);
      console.log('  Refresh token length:', session.refresh_token.length);
    } else {
      console.log('✗ No session');
    }
  });
}
```

### Browser-Specific Issues

If a single user can't authenticate while others can:

1. **Safari/iOS**: Strictest third-party cookie blocking. May need to access subdomain directly first.
2. **Firefox Enhanced Tracking Protection**: Can block cross-origin postMessage.
3. **Browser Extensions**: Privacy Badger, uBlock Origin, DuckDuckGo extension block iframe communication.
4. **Incognito/Private Mode**: Enhanced restrictions on cross-origin storage.
5. **Corporate VPN/Proxy**: May strip headers or block iframe communication.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | January 2026 | Consolidated docs, fixed postMessage security, added browser troubleshooting |
| 1.0 | January 2026 | Initial documentation |
