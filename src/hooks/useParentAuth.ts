/**
 * useParentAuth Hook - Simplified Auth for BuntingGPT Subdomain Apps
 * 
 * Listens for AUTH_TOKEN from parent buntinggpt.com and sets session.
 * Handles both embedded mode (iframe) and standalone mode.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

// Only accept messages from buntinggpt.com domains
const isAllowedOrigin = (origin: string): boolean => {
  // Exact match for main domains
  if (origin === 'https://buntinggpt.com' || 
      origin === 'https://www.buntinggpt.com') return true;
  
  // Any *.buntinggpt.com subdomain
  if (origin.endsWith('.buntinggpt.com')) return true;
  
  // Localhost for development
  if (origin.startsWith('http://localhost:')) return true;
  
  return false;
};

export interface ParentAuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isEmbedded: boolean;
  authReceived: boolean;
  error: string | null;
  requestAuth: () => void;
}

export function useParentAuth(): ParentAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authReceived, setAuthReceived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

  const requestAuth = useCallback(() => {
    if (isEmbedded && window.parent) {
      console.log('[useParentAuth] Requesting auth from parent...');
      // Send to explicit origins for security
      window.parent.postMessage({ type: 'REQUEST_AUTH' }, 'https://buntinggpt.com');
      window.parent.postMessage({ type: 'REQUEST_AUTH' }, 'https://www.buntinggpt.com');
    }
  }, [isEmbedded]);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    // Log ALL incoming messages for debugging
    console.log('[useParentAuth] Received message:', {
      origin: event.origin,
      type: event.data?.type,
      hasToken: !!event.data?.token,
      hasRefreshToken: !!event.data?.refreshToken,
      timestamp: new Date().toISOString()
    });

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
      
      console.log('[useParentAuth] Processing', data.type, 'from', event.origin);

      const { token, refreshToken } = data;

      // Handle logout signal (null token)
      if (!token) {
        console.log('[useParentAuth] Received logout signal (null token) from parent');
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setAuthReceived(false);
        setError(null);
        setIsLoading(false);
        return;
      }

      // Validate access token exists
      if (token.length < 20) {
        console.error('[useParentAuth] Missing or invalid access token');
        setError('Invalid access token received');
        setIsLoading(false);
        return;
      }

      // Warn about missing refresh token but don't block
      if (!refreshToken || refreshToken.length < 20) {
        console.warn('[useParentAuth] Missing or short refresh token');
      }

      console.log('[useParentAuth] Token details:', {
        hasAccessToken: !!token,
        accessTokenLength: token?.length || 0,
        hasRefreshToken: !!refreshToken,
        refreshTokenLength: refreshToken?.length || 0
      });

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshToken || '',
        });

        console.log('[useParentAuth] setSession result:', {
          success: !sessionError,
          hasSession: !!sessionData?.session,
          hasUser: !!sessionData?.session?.user,
          userId: sessionData?.session?.user?.id,
          email: sessionData?.session?.user?.email,
          error: sessionError?.message,
          timestamp: new Date().toISOString()
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

    // Handle explicit logout message type
    if (data.type === 'AUTH_LOGOUT') {
      console.log('[useParentAuth] Received AUTH_LOGOUT from parent');
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setAuthReceived(false);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);

    if (isEmbedded) {
      console.log('[useParentAuth] Embedded mode detected, waiting for parent auth...');
      
      // Request auth immediately
      requestAuth();

      // Retry every 200ms (max 3 times) in case of race condition
      let retryCount = 0;
      const retryInterval = setInterval(() => {
        if (!authReceived && retryCount < 3) {
          retryCount++;
          console.log('[useParentAuth] Retry attempt:', { count: retryCount });
          requestAuth();
        } else {
          clearInterval(retryInterval);
        }
      }, 200);

      // Timeout after 3 seconds (parent should respond nearly instantly)
      const timeout = setTimeout(() => {
        clearInterval(retryInterval);
        if (!authReceived) {
          console.error('[useParentAuth] Auth timeout after 3s');
          setError('Authentication timeout - no response from parent app');
          setIsLoading(false);
        }
      }, 3000);

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
}
