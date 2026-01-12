/**
 * useParentAuth Hook - Simplified Auth for BuntingGPT Subdomain Apps
 * 
 * Listens for AUTH_TOKEN from parent buntinggpt.com and sets session.
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ParentAuthState {
  isEmbedded: boolean;
  authReceived: boolean;
  isLoading: boolean;
  error: string | null;
  user: { id: string; email: string } | null;
}

export function useParentAuth(): ParentAuthState {
  // Detect if running in iframe
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
  
  const [authReceived, setAuthReceived] = useState(false);
  const [isLoading, setIsLoading] = useState(isEmbedded);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const authAttempted = useRef(false);

  useEffect(() => {
    // Only run in embedded mode
    if (!isEmbedded) {
      console.log('[useParentAuth] Not embedded, skipping parent auth');
      setIsLoading(false);
      return;
    }

    console.log('[useParentAuth] Init:', { 
      isEmbedded, 
      timestamp: new Date().toISOString(),
      parentOrigin: window.parent !== window ? 'has parent' : 'no parent'
    });

    // Listen for parent to send token
    const handleMessage = async (event: MessageEvent) => {
      // Log ALL incoming messages for debugging
      console.log('[useParentAuth] Received message:', {
        origin: event.origin,
        type: event.data?.type,
        hasToken: !!event.data?.token,
        tokenLength: event.data?.token?.length || 0,
        tokenPreview: event.data?.token ? event.data.token.substring(0, 30) + '...' : null,
        timestamp: new Date().toISOString()
      });

      // Only accept from parent domain (www and non-www)
      const ALLOWED_ORIGINS = [
        'https://buntinggpt.com',
        'https://www.buntinggpt.com'
      ];
      
      if (!ALLOWED_ORIGINS.includes(event.origin)) {
        console.log('[useParentAuth] Rejected message: origin mismatch', { 
          received: event.origin, 
          expected: ALLOWED_ORIGINS 
        });
        return;
      }

      if (event.data.type === 'AUTH_TOKEN') {
        console.log('[useParentAuth] Processing AUTH_TOKEN from parent');
        authAttempted.current = true;

        const token = event.data.token;
        const refreshToken = event.data.refreshToken || ''; // Parent sends refreshToken (camelCase)

        if (token) {
          try {
            console.log('[useParentAuth] Attempting to set session with token...');
            console.log('[useParentAuth] Token details:', {
              hasAccessToken: !!token,
              accessTokenLength: token?.length || 0,
              hasRefreshToken: !!refreshToken,
              refreshTokenLength: refreshToken?.length || 0
            });
            
            // Set the session manually in Supabase client
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: token,
              refresh_token: refreshToken // Use refresh token from parent
            });

            console.log('[useParentAuth] setSession result:', {
              success: !sessionError,
              hasData: !!data,
              hasUser: !!data?.user,
              userId: data?.user?.id,
              email: data?.user?.email,
              error: sessionError?.message,
              errorCode: sessionError?.code,
              timestamp: new Date().toISOString()
            });

            if (sessionError) {
              console.error('[useParentAuth] Failed to set session:', sessionError);
              setError(`Failed to establish session: ${sessionError.message}`);
              setIsLoading(false);
              return;
            }

            if (data.user) {
              console.log('[useParentAuth] Session established successfully:', {
                userId: data.user.id,
                email: data.user.email,
                timestamp: new Date().toISOString()
              });
              setUser({ id: data.user.id, email: data.user.email || '' });
              setAuthReceived(true);
              setError(null);
            } else {
              console.warn('[useParentAuth] setSession succeeded but no user returned');
              setError('Session set but no user data');
            }
          } catch (err) {
            console.error('[useParentAuth] Error setting session:', err);
            setError(`Authentication error: ${err instanceof Error ? err.message : 'Unknown'}`);
          }
        } else {
          // Parent sent null token = logout signal
          console.log('[useParentAuth] Received logout signal (null token) from parent');
          await supabase.auth.signOut();
          setUser(null);
          setAuthReceived(false);
          setError(null);
        }

        setIsLoading(false);
      }

      // Handle explicit logout message type
      if (event.data.type === 'AUTH_LOGOUT') {
        console.log('[useParentAuth] Received AUTH_LOGOUT from parent');
        await supabase.auth.signOut();
        setUser(null);
        setAuthReceived(false);
        setError(null);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request auth from parent on load
    // Send to '*' since we don't know if parent is www or non-www
    // Security is maintained via origin validation on incoming messages
    const requestAuth = () => {
      console.log('[useParentAuth] Sending REQUEST_AUTH to parent:', {
        targetOrigin: '*',
        timestamp: new Date().toISOString()
      });
      window.parent.postMessage({
        type: 'REQUEST_AUTH'
      }, '*');
    };

    // Request immediately
    requestAuth();

    // Retry quickly in case of race condition (max 3 retries, 200ms apart)
    let retryCount = 0;
    const retryInterval = setInterval(() => {
      if (!authAttempted.current && retryCount < 3) {
        retryCount++;
        console.log('[useParentAuth] Retry attempt:', { 
          count: retryCount, 
          authAttempted: authAttempted.current,
          timestamp: new Date().toISOString() 
        });
        requestAuth();
      } else {
        clearInterval(retryInterval);
      }
    }, 200);

    // Timeout after 3 seconds (parent should respond nearly instantly)
    const timeout = setTimeout(() => {
      clearInterval(retryInterval);
      if (!authAttempted.current) {
        console.warn('[useParentAuth] Auth timeout - no response from parent:', {
          authAttempted: authAttempted.current,
          retryCount,
          timestamp: new Date().toISOString()
        });
        setError('Authentication timeout - parent did not respond');
        setIsLoading(false);
      }
    }, 3000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(retryInterval);
      clearTimeout(timeout);
    };
  }, [isEmbedded]);

  return {
    isEmbedded,
    authReceived,
    isLoading,
    error,
    user
  };
}
