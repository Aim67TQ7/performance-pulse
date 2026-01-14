/**
 * TokenContext - Session-Based Access Control
 *
 * Checks for Supabase session from cross-subdomain cookies.
 * Redirects to login.buntinggpt.com if not authenticated.
 * Provides employee_id for data queries throughout the app.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface TokenContextType {
  isLoading: boolean;
  isValid: boolean;
  employeeId: string | null;
  session: Session | null;
  error: string | null;
}

const defaultContextValue: TokenContextType = {
  isLoading: true,
  isValid: false,
  employeeId: null,
  session: null,
  error: null,
};

const TokenContext = createContext<TokenContextType>(defaultContextValue);

export const useToken = () => {
  return useContext(TokenContext);
};

const AUTH_HUB_URL = 'https://login.buntinggpt.com';

function setAuthIssuedAtCookie(timestampMs: number) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  // Only set cross-subdomain cookie on buntinggpt.com
  const isBuntingDomain = window.location.hostname.endsWith('.buntinggpt.com');
  if (!isBuntingDomain) return;

  // Keep cookie readable by the Edge Function (not HttpOnly).
  // Edge Function enforces the 24h window; we set a 30d max-age to avoid churn.
  const maxAgeSeconds = 60 * 60 * 24 * 30;
  document.cookie = `bunting_auth_issued_at=${timestampMs}; Domain=.buntinggpt.com; Path=/; SameSite=Lax; Secure; Max-Age=${maxAgeSeconds}`;
}

export function TokenProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        // Check for existing Supabase session from cookies
        const {
          data: { session: currentSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        console.log('[TokenContext] Session check:', {
          hasSession: !!currentSession,
          userId: currentSession?.user?.id,
          error: sessionError,
        });

        if (sessionError) {
          console.error('[TokenContext] Session error:', sessionError);
          setError('Session verification failed');
          setIsLoading(false);
          return;
        }

        if (!currentSession) {
          // No session - redirect to login hub with return URL
          console.log('[TokenContext] No session, redirecting to login hub');
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.href = `${AUTH_HUB_URL}?return_url=${returnUrl}`;
          return;
        }

        const userId = currentSession.user.id;
        console.log('[TokenContext] Session valid, looking up employee for user:', userId);

        // Look up employee by user_id (Supabase auth user ID)
        let { data: employee, error: empError } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        // Fallback: If not found by user_id, try by id (for hourly employees)
        if (!employee && !empError) {
          console.log('[TokenContext] user_id lookup failed, trying by id');
          const fallbackResult = await supabase
            .from('employees')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

          employee = fallbackResult.data;
          empError = fallbackResult.error;
        }

        if (empError) {
          console.error('[TokenContext] Employee query error:', empError);
          setError('Failed to verify employee');
          setIsLoading(false);
          return;
        }

        if (!employee) {
          console.error('[TokenContext] Employee not found for user:', userId);
          setError('Employee record not found');
          setIsLoading(false);
          return;
        }

        // All valid - store session and employee.id
        console.log('[TokenContext] Verification complete, employee:', employee.id);
        setSession(currentSession);
        setEmployeeId(employee.id);
        setIsValid(true);

        // Ensure the 24h freshness cookie exists for the Edge Function.
        // This prevents redirect loops for users whose login flow didn't set it yet.
        setAuthIssuedAtCookie(Date.now());

        setIsLoading(false);
      } catch (err) {
        console.error('[TokenContext] Verification error:', err);
        setError('An error occurred during verification');
        setIsLoading(false);
      }
    };

    verifySession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[TokenContext] Auth state change:', event);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Keep freshness marker up-to-date whenever Supabase refreshes tokens.
        setAuthIssuedAtCookie(Date.now());
        if (newSession) setSession(newSession);
      }

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setEmployeeId(null);
        setIsValid(false);
        // Redirect to login hub
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `${AUTH_HUB_URL}?return_url=${returnUrl}`;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: TokenContextType = {
    isLoading,
    isValid,
    employeeId,
    session,
    error,
  };

  return (
    <TokenContext.Provider value={value}>
      {children}
    </TokenContext.Provider>
  );
}
