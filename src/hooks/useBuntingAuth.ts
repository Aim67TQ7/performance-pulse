/**
 * Bunting Auth Hook - Reusable authentication for *.buntinggpt.com apps
 * 
 * USAGE:
 * 1. Copy this file to your app's hooks folder
 * 2. Create a Supabase client with the same config (see below)
 * 3. Use the hook in your app's root or protected routes
 * 
 * REQUIRED SUPABASE CLIENT CONFIG (this project already does this in src/integrations/supabase/client.ts):
 * ```typescript
 * import { createClient } from '@supabase/supabase-js';
 *
 * export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
 *   auth: {
 *     // In production on *.buntinggpt.com we use a cookie-based storage so sessions cross subdomains
 *     persistSession: true,
 *     autoRefreshToken: true,
 *     detectSessionInUrl: true,
 *     flowType: 'pkce',
 *   }
 * });
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Configuration - Update these for your environment
const AUTH_HUB_URL = 'https://login.buntinggpt.com';
const ALLOWED_DOMAINS = ['.buntinggpt.com', 'localhost'];
const ALLOWED_PARENT_ORIGINS = ['https://buntinggpt.com', 'https://www.buntinggpt.com', 'http://localhost:5173'];

export interface BuntingAuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True when running inside an iframe */
  isEmbedded: boolean;
  /** In embedded mode, becomes true once we've received/attempted parent auth */
  authReceived: boolean;
  /** Error message if auth failed */
  error: string | null;
  /** Request auth from parent window (embedded mode only) */
  requestAuth: () => void;
}

interface UseBuntingAuthOptions {
  /** If true, automatically redirects to login when not authenticated (standalone only) */
  requireAuth?: boolean;
  /** Custom return URL after login (defaults to current page) */
  returnUrl?: string;
  /** Callback when auth state changes */
  onAuthChange?: (state: BuntingAuthState) => void;
}

export interface UseBuntingAuthReturn extends BuntingAuthState {
  /** Redirect to the central login hub */
  login: () => void;
  /** Sign out and redirect to logout page */
  logout: () => void;
  /** Get the user's display name */
  displayName: string | null;
  /** Get the user's email */
  email: string | null;
}

/**
 * Check if the current domain is allowed
 */
const isAllowedDomain = (): boolean => {
  const hostname = window.location.hostname;
  return ALLOWED_DOMAINS.some(domain => 
    domain === 'localhost' 
      ? hostname === 'localhost' 
      : hostname.endsWith(domain)
  );
};

const isEmbedded = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const isAllowedParentOrigin = (origin: string): boolean => {
  if (ALLOWED_PARENT_ORIGINS.includes(origin)) return true;
  // allow any subdomain of buntinggpt.com that ends with buntinggpt.com over https
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('buntinggpt.com');
  } catch {
    return false;
  }
};

/**
 * Bunting Authentication Hook
 * 
 * Provides authentication state and methods for apps in the *.buntinggpt.com domain.
 * Sessions are shared across all subdomains via Supabase's built-in session management.
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { isLoading, isAuthenticated, user, logout } = useBuntingAuth({ 
 *     requireAuth: true 
 *   });
 * 
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isAuthenticated) return null; // Will redirect automatically
 * 
 *   return (
 *     <div>
 *       <p>Welcome, {user?.email}</p>
 *       <button onClick={logout}>Sign Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBuntingAuth(options: UseBuntingAuthOptions = {}): UseBuntingAuthReturn {
  const { requireAuth = false, returnUrl, onAuthChange } = options;

  const embedded = isEmbedded();

  const [state, setState] = useState<BuntingAuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    isEmbedded: embedded,
    authReceived: !embedded, // in standalone we consider "received" immediately
    error: null,
    requestAuth: () => {},
  });

  // Redirect to the central login hub
  const login = useCallback(() => {
    const currentUrl = returnUrl || window.location.href;
    const loginUrl = `${AUTH_HUB_URL}?return_url=${encodeURIComponent(currentUrl)}`;
    window.location.href = loginUrl;
  }, [returnUrl]);

  // Sign out and redirect to logout page
  const logout = useCallback(() => {
    const logoutUrl = `${AUTH_HUB_URL}/logout`;
    window.location.href = logoutUrl;
  }, []);

  useEffect(() => {
    // Validate domain
    if (!isAllowedDomain()) {
      console.warn('[BuntingAuth] This hook only works on *.buntinggpt.com domains');
      setState(prev => ({ ...prev, isLoading: false, error: 'Invalid domain' }));
      return;
    }

    const embeddedMode = isEmbedded();

    // Request auth from parent (embedded mode)
    const requestAuth = () => {
      if (!embeddedMode) return;
      try {
        window.parent?.postMessage({ type: 'REQUEST_AUTH' }, '*');
      } catch (e) {
        console.warn('[BuntingAuth] Failed to postMessage REQUEST_AUTH', e);
      }
    };

    setState(prev => ({ ...prev, isEmbedded: embeddedMode, requestAuth }));

    // Handle parent -> child auth messages
    const handleMessage = async (event: MessageEvent) => {
      if (!embeddedMode) return;
      if (!isAllowedParentOrigin(event.origin)) return;

      const data: any = event.data;
      const type = data?.type;

      if (type === 'AUTH_LOGOUT' || (type === 'AUTH_TOKEN' && !data?.token)) {
        await supabase.auth.signOut();
        setState(prev => ({
          ...prev,
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          authReceived: true,
          error: null,
        }));
        return;
      }

      if (type !== 'AUTH_TOKEN') return;

      const token = data?.token;
      const refreshToken = data?.refreshToken;

      if (typeof token !== 'string' || token.length < 20) {
        setState(prev => ({ ...prev, isLoading: false, authReceived: true, error: 'Invalid access token' }));
        return;
      }
      if (typeof refreshToken !== 'string' || refreshToken.length < 20) {
        setState(prev => ({ ...prev, isLoading: false, authReceived: true, error: 'Invalid refresh token' }));
        return;
      }

      const { data: setData, error } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: refreshToken,
      });

      if (error) {
        setState(prev => ({ ...prev, isLoading: false, authReceived: true, error: error.message }));
        return;
      }

      const session = setData.session ?? null;
      const newState: BuntingAuthState = {
        user: session?.user ?? null,
        session,
        isLoading: false,
        isAuthenticated: !!session?.user,
        isEmbedded: embeddedMode,
        authReceived: true,
        error: null,
        requestAuth,
      };

      setState(newState);
      onAuthChange?.(newState);
    };

    window.addEventListener('message', handleMessage);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[BuntingAuth] Auth state changed:', event);

        const newState: BuntingAuthState = {
          user: session?.user ?? null,
          session,
          isLoading: false,
          isAuthenticated: !!session?.user,
          isEmbedded: embeddedMode,
          authReceived: embeddedMode ? event !== 'INITIAL_SESSION' : true,
          error: null,
          requestAuth,
        };

        setState(newState);
        onAuthChange?.(newState);

        // Redirect to login ONLY in standalone mode
        if (!embeddedMode && requireAuth && !session?.user && event !== 'INITIAL_SESSION') {
          login();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[BuntingAuth] Error getting session:', error);
      }

      const newState: BuntingAuthState = {
        user: session?.user ?? null,
        session,
        isLoading: false,
        isAuthenticated: !!session?.user,
        isEmbedded: embeddedMode,
        authReceived: !embeddedMode, // in embedded mode, wait for parent auth attempt
        error: null,
        requestAuth,
      };

      setState(newState);
      onAuthChange?.(newState);

      if (embeddedMode && !session?.user) {
        // Kick off parent auth request + retries for ~3s
        requestAuth();
        const start = Date.now();
        const interval = setInterval(() => {
          if (Date.now() - start > 3000) {
            clearInterval(interval);
            setState(prev => ({ ...prev, authReceived: true }));
            return;
          }
          requestAuth();
        }, 200);
      }

      // Redirect to login ONLY in standalone mode
      if (!embeddedMode && requireAuth && !session?.user) {
        login();
      }
    });

    return () => {
      window.removeEventListener('message', handleMessage);
      subscription.unsubscribe();
    };
  }, [requireAuth, login, onAuthChange]);

  // Derived user info
  const displayName = state.user?.user_metadata?.full_name 
    || state.user?.user_metadata?.name 
    || state.user?.email?.split('@')[0] 
    || null;

  const email = state.user?.email || null;

  return {
    ...state,
    login,
    logout,
    displayName,
    email,
  };
}

