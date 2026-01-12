/**
 * useParentAuth Hook for BuntingGPT Subdomain Apps
 * 
 * This hook enables subdomain apps (*.buntinggpt.com) to receive
 * authentication from the parent buntinggpt.com app when embedded as iframes.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Allowed origins that can send auth messages
const ALLOWED_ORIGINS = [
  'https://buntinggpt.com',
  'https://www.buntinggpt.com',
];

const isAllowedOrigin = (origin: string): boolean => {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.buntinggpt.com')) return true;
  // Allow localhost for development
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  return false;
};

interface ParentAuthState {
  isEmbedded: boolean;
  authReceived: boolean;
  isLoading: boolean;
  error: string | null;
  user: { id: string; email: string } | null;
}

export function useParentAuth(): ParentAuthState & { requestAuth: () => void } {
  // Detect if we're in an iframe
  const [isEmbedded] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true; // Cross-origin iframe
    }
  });

  const [authReceived, setAuthReceived] = useState(false);
  const [isLoading, setIsLoading] = useState(isEmbedded);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  
  const authAttempted = useRef(false);

  // Request auth from parent
  const requestAuth = useCallback(() => {
    if (!isEmbedded) return;
    
    console.log('[useParentAuth] Requesting auth from parent...');
    window.parent.postMessage({
      type: 'BUNTINGGPT_AUTH_REQUEST',
      origin: window.location.origin,
      timestamp: Date.now()
    }, '*');
  }, [isEmbedded]);

  useEffect(() => {
    // If not embedded, use normal Supabase auth flow
    if (!isEmbedded) {
      setIsLoading(false);
      return;
    }

    console.log('[useParentAuth] Running in embedded mode, waiting for parent auth...');

    // First, check if we already have a valid session from cross-domain cookies
    const checkExistingSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session && !error) {
          console.log('[useParentAuth] Found existing session from cookies!', session.user.email);
          setAuthReceived(true);
          setIsLoading(false);
          setUser({ id: session.user.id, email: session.user.email || '' });
          authAttempted.current = true;
          return true;
        }
      } catch (err) {
        console.log('[useParentAuth] No existing session found');
      }
      return false;
    };

    const handleMessage = async (event: MessageEvent) => {
      // Validate origin
      if (!isAllowedOrigin(event.origin)) {
        console.log('[useParentAuth] Ignoring message from:', event.origin);
        return;
      }

      const data = event.data;
      if (!data?.type) return;

      console.log('[useParentAuth] Received message:', data.type, 'from:', event.origin);

      // Handle both new and legacy message formats
      if (data.type === 'BUNTINGGPT_AUTH_TOKEN' || data.type === 'PROVIDE_TOKEN') {
        // Support both camelCase and snake_case
        const accessToken = data.accessToken || data.access_token;
        const refreshToken = data.refreshToken || data.refresh_token;

        if (!accessToken || !refreshToken) {
          console.error('[useParentAuth] Missing tokens in message');
          return;
        }

        // Validate access token is a JWT
        if (accessToken.split('.').length !== 3) {
          console.error('[useParentAuth] Invalid access token format');
          setError('Invalid access token format');
          setIsLoading(false);
          return;
        }

        // Validate refresh token has substance (it's opaque, NOT a JWT!)
        if (refreshToken.length < 20) {
          console.error('[useParentAuth] Refresh token appears truncated:', refreshToken.length);
          setError('Refresh token too short');
          setIsLoading(false);
          return;
        }

        console.log('[useParentAuth] Setting session with tokens:', {
          accessTokenLength: accessToken.length,
          refreshTokenLength: refreshToken.length
        });

        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) {
            console.error('[useParentAuth] setSession error:', sessionError);
            setError(sessionError.message);
            setIsLoading(false);
            return;
          }

          console.log('[useParentAuth] Session established successfully!');
          setAuthReceived(true);
          setIsLoading(false);
          setError(null);

          // Set user from message or session
          if (data.user) {
            setUser(data.user);
          } else if (sessionData.user) {
            setUser({ id: sessionData.user.id, email: sessionData.user.email || '' });
          }

          // Acknowledge receipt (optional)
          window.parent.postMessage({
            type: 'TOKEN_RECEIVED',
            origin: window.location.origin,
            timestamp: Date.now()
          }, event.origin);

        } catch (err) {
          console.error('[useParentAuth] Exception setting session:', err);
          setError('Failed to establish session');
          setIsLoading(false);
        }
      }

      // Handle legacy PROVIDE_USER message
      if (data.type === 'PROVIDE_USER' && data.user) {
        console.log('[useParentAuth] Received user data:', data.user.email);
        setUser(data.user);
      }
    };

    // Start by checking for existing session
    checkExistingSession().then((hasSession) => {
      if (hasSession) {
        console.log('[useParentAuth] Using existing cookie session, skipping parent auth request');
        return;
      }

      // No existing session, set up message listener and request from parent
      window.addEventListener('message', handleMessage);

      // Request auth from parent immediately
      requestAuth();

      // Retry every 2 seconds for up to 10 seconds
      const retryInterval = setInterval(() => {
        if (!authAttempted.current) {
          requestAuth();
        }
      }, 2000);

      const timeout = setTimeout(() => {
        clearInterval(retryInterval);
        if (!authReceived) {
          console.warn('[useParentAuth] Auth timeout - no response from parent');
          setError('Authentication timeout - parent did not respond');
          setIsLoading(false);
        }
      }, 10000);

      // Cleanup will be handled by the outer effect
      return () => {
        window.removeEventListener('message', handleMessage);
        clearInterval(retryInterval);
        clearTimeout(timeout);
      };
    });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isEmbedded, requestAuth, authReceived]);

  // Mark as attempted when auth received
  useEffect(() => {
    if (authReceived) {
      authAttempted.current = true;
    }
  }, [authReceived]);

  return {
    isEmbedded,
    authReceived,
    isLoading,
    error,
    user,
    requestAuth
  };
}
