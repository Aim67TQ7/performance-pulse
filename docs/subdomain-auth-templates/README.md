# BuntingGPT Subdomain App Authentication

Simple auth pattern for subdomain apps embedded in buntinggpt.com iframes.

## How It Works

1. Subdomain app sends `REQUEST_AUTH` to parent
2. Parent responds with `AUTH_TOKEN` containing access token
3. App calls `supabase.auth.setSession()` with token
4. RLS-protected queries now work

## Message Protocol

**Request (child → parent):**
```json
{ "type": "REQUEST_AUTH" }
```

**Response (parent → child):**
```json
{ "type": "AUTH_TOKEN", "token": "eyJ..." }
```

## Files

- `src/hooks/useParentAuth.ts` - Handles postMessage auth flow
- `src/components/PrivateRoute.tsx` - Protects routes, shows loading states
- `src/contexts/AuthContext.tsx` - Standard Supabase auth context

## Parent App Implementation

The parent (buntinggpt.com) must listen for `REQUEST_AUTH` and respond:

```javascript
window.addEventListener('message', async (event) => {
  if (event.data.type === 'REQUEST_AUTH') {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      event.source.postMessage({
        type: 'AUTH_TOKEN',
        token: session.access_token
      }, event.origin);
    }
  }
});
```
