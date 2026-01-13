/**
 * Bunting Auth Hook - Reusable authentication for *.buntinggpt.com apps
 * 
 * USAGE:
 * 1. Copy this file to your app's hooks folder
 * 2. Create a Supabase client with the same config (see below)
 * 3. Use the hook in your app's root or protected routes
 * 
 * REQUIRED SUPABASE CLIENT CONFIG:
 * ```typescript
 * import { createClient } from '@supabase/supabase-js';
 * 
 * const SUPABASE_URL = "https://qzwxisdfwswsrbzvpzlo.supabase.co";
 * const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
 * 
 * export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
 *   auth: {
 *     storage: localStorage,
 *     persistSession: true,
 *     autoRefreshToken: true,
 *   }
 * });
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Configuration - Update these for your environment
const AUTH_HUB_URL = 'https://login.buntinggpt.com';
const ALLOWED_DOMAINS = ['.buntinggpt.com', 'localhost'];

export interface BuntingAuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface UseBuntingAuthOptions {
  /** If true, automatically redirects to login when not authenticated */
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

  const [state, setState] = useState<BuntingAuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
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
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[BuntingAuth] Auth state changed:', event);
        
        const newState: BuntingAuthState = {
          user: session?.user ?? null,
          session,
          isLoading: false,
          isAuthenticated: !!session?.user,
        };
        
        setState(newState);
        onAuthChange?.(newState);

        // Redirect to login if auth is required and user is not authenticated
        if (requireAuth && !session?.user && event !== 'INITIAL_SESSION') {
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
      };
      
      setState(newState);
      onAuthChange?.(newState);

      // Redirect to login if auth is required and no session
      if (requireAuth && !session?.user) {
        login();
      }
    });

    return () => {
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

