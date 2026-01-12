# Cross-Subdomain Authentication System

## For *.buntinggpt.com Applications

---

## Overview

This document describes how the parent app (`buntinggpt.com`) authenticates subdomain apps (`*.buntinggpt.com`) loaded in iframes.

**Related Document:** See `subdomain-auth.md` for implementation details specific to subdomain apps.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Parent App (buntinggpt.com)                                    │
│                                                                 │
│  1. User logs in → Supabase session established                 │
│  2. User opens app → navigates to /iframe?url=self.buntinggpt.com│
│  3. Iframe loads → parent sends AUTH_TOKEN message              │
│  4. Parent listens for REQUEST_AUTH from child                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Subdomain App (self.buntinggpt.com) - IFRAME             │  │
│  │                                                           │  │
│  │  5. useParentAuth listens for AUTH_TOKEN                  │  │
│  │  6. Validates origin is *.buntinggpt.com                  │  │
│  │  7. Calls supabase.auth.setSession(tokens)                │  │
│  │  8. App renders authenticated content                     │  │
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

### Parent → Subdomain (AUTH_TOKEN)

Sent when iframe loads and in response to REQUEST_AUTH:

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

### Subdomain → Parent (REQUEST_AUTH)

Sent by subdomain if token not received within 2 seconds:

```typescript
// Primary format
{ type: 'REQUEST_AUTH' }

// Legacy format (also supported)
{ type: 'BUNTINGGPT_AUTH_REQUEST' }
```

---

## Parent App Implementation

### Iframe.tsx (or equivalent)

The parent must send auth tokens when iframes load and respond to auth requests:

```typescript
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IframeProps {
  src: string;
}

// Only send auth to trusted subdomains
const isAllowedOrigin = (origin: string): boolean => {
  return origin === 'https://buntinggpt.com' || 
         origin === 'https://www.buntinggpt.com' ||
         origin.endsWith('.buntinggpt.com') ||
         origin.startsWith('http://localhost:');
};

export const Iframe = ({ src }: IframeProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send auth token to iframe
  const sendAuthToken = async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('[Iframe] No session to send');
      return;
    }

    const targetOrigin = new URL(src).origin;
    
    const message = {
      type: 'AUTH_TOKEN',
      token: session.access_token,
      refreshToken: session.refresh_token,
      user: {
        id: session.user.id,
        email: session.user.email
      }
    };

    iframe.contentWindow.postMessage(message, targetOrigin);
    console.log('[Iframe] Sent AUTH_TOKEN to', targetOrigin);
  };

  // Listen for auth requests from subdomain
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isAllowedOrigin(event.origin)) {
        console.log('[Iframe] Rejected message from:', event.origin);
        return;
      }

      const { type } = event.data || {};
      
      // Handle REQUEST_AUTH (primary) and legacy format
      if (type === 'REQUEST_AUTH' || type === 'BUNTINGGPT_AUTH_REQUEST') {
        console.log('[Iframe] Received', type, 'from', event.origin);
        sendAuthToken();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [src]);

  // Send auth when iframe loads
  const handleLoad = () => {
    console.log('[Iframe] Iframe loaded, sending auth...');
    sendAuthToken();
  };

  // Re-send auth when session changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        console.log('[Iframe] Auth state changed, re-sending token');
        sendAuthToken();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      onLoad={handleLoad}
      className="w-full h-full border-0"
      title="Subdomain App"
    />
  );
};
```

---

## Supabase Client Configuration

Both parent and subdomain apps must use the same cookie-based storage for session sharing:

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

---

## Allowed Origins

Both parent and subdomain apps validate message origins using the same logic:

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

### 2. Cookie Domain Must Include Leading Dot

```typescript
// ❌ WRONG - Won't share across subdomains
document.cookie = `token=xxx; domain=buntinggpt.com`;

// ✅ CORRECT - Shares across all *.buntinggpt.com
document.cookie = `token=xxx; domain=.buntinggpt.com`;
```

### 3. Always Use Explicit Origin for postMessage

```typescript
// ❌ WRONG - Security risk
iframe.contentWindow.postMessage(message, '*');

// ✅ CORRECT - Explicit target origin
const targetOrigin = new URL(iframeSrc).origin;
iframe.contentWindow.postMessage(message, targetOrigin);
```

### 4. Subdomain Apps Must Never Redirect When Embedded

This is enforced in the subdomain app's PrivateRoute component. See `subdomain-auth.md` for details.

---

## Troubleshooting

### Debug Script (Parent Console)

```javascript
console.log('=== PARENT AUTH DEBUG ===');
console.log('Hostname:', window.location.hostname);

// Check session
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    console.log('✓ Session exists');
    console.log('  User:', session.user.email);
    console.log('  Access token length:', session.access_token.length);
    console.log('  Refresh token length:', session.refresh_token.length);
  } else {
    console.log('✗ No session - user not logged in');
  }
});

// Check cookies
const cookies = document.cookie;
console.log('Has auth cookies:', cookies.includes('_chunk_'));

// Check iframes
const iframes = document.querySelectorAll('iframe');
console.log('Iframe count:', iframes.length);
iframes.forEach((iframe, i) => {
  console.log(`  Iframe ${i}:`, iframe.src);
});
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Subdomain shows "Authenticating..." forever | Parent not sending AUTH_TOKEN | Check Iframe.tsx has sendAuthToken on load |
| "No session to send" in parent console | User not logged in on parent | Ensure login completes before loading iframe |
| Origin validation fails | www vs non-www mismatch | Add both to ALLOWED_ORIGINS |
| Session doesn't persist across refreshes | Cookie storage not configured | Use cookieStorage with .buntinggpt.com domain |
| Works for most users, fails for one | Browser-specific restrictions | See browser troubleshooting below |

### Browser-Specific Issues

If a single user can't authenticate while others can:

1. **Safari/iOS**: Strictest third-party cookie blocking. User may need to visit subdomain directly first.
2. **Firefox Enhanced Tracking Protection**: Can block cross-origin postMessage.
3. **Browser Extensions**: Privacy Badger, uBlock Origin, DuckDuckGo extension can block iframe communication.
4. **Incognito/Private Mode**: Enhanced restrictions on cross-origin storage.
5. **Corporate VPN/Proxy**: May strip headers or block iframe communication.

**Diagnostic Questions:**
- What browser and version?
- Private/incognito mode?
- Any privacy extensions installed?
- Corporate network or VPN?

---

## Subdomain App Setup

For subdomain apps, copy these template files from the parent app:

| Source (Parent App) | Destination (Subdomain App) |
|---------------------|----------------------------|
| `src/integrations/supabase/client.ts` | `src/integrations/supabase/client.ts` |
| `docs/subdomain-auth-templates/useParentAuth.ts` | `src/hooks/useParentAuth.ts` |
| `docs/subdomain-auth-templates/AuthContext.tsx` | `src/contexts/AuthContext.tsx` |
| `docs/subdomain-auth-templates/PrivateRoute.tsx` | `src/components/PrivateRoute.tsx` |

See `subdomain-auth.md` for complete subdomain implementation details.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.0 | January 2026 | Consolidated with subdomain-auth.md, fixed postMessage security, added browser troubleshooting |
| 4.0 | January 2026 | Updated message protocol to AUTH_TOKEN, added complete template files |
| 3.0 | January 2026 | Added cookie chunking for large JWTs |
| 2.0 | January 2026 | Switched from localStorage to cookie-based storage |
| 1.0 | January 2026 | Initial documentation |
