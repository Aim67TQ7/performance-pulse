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
      setIsLoading(false);
      return;
    }

    console.log('[useParentAuth] Running in embedded mode, requesting auth from parent...');

    // Listen for parent to send token
    const handleMessage = async (event: MessageEvent) => {
      // Only accept from parent domain
      if (event.origin !== 'https://buntinggpt.com') {
        return;
      }

      if (event.data.type === 'AUTH_TOKEN') {
        console.log('[useParentAuth] Received AUTH_TOKEN from parent');
        authAttempted.current = true;

        const token = event.data.token;

        if (token) {
          try {
            // Set the session manually in Supabase client
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: token,
              refresh_token: '' // Parent handles refresh
            });

            if (sessionError) {
              console.error('[useParentAuth] Failed to set session:', sessionError);
              setError('Failed to establish session');
              setIsLoading(false);
              return;
            }

            if (data.user) {
              console.log('[useParentAuth] Session established for:', data.user.email);
              setUser({ id: data.user.id, email: data.user.email || '' });
              setAuthReceived(true);
              setError(null);
            }
          } catch (err) {
            console.error('[useParentAuth] Error setting session:', err);
            setError('Authentication error');
          }
        } else {
          console.warn('[useParentAuth] No token in AUTH_TOKEN message');
          setError('No authentication token received');
        }

        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request auth from parent on load
    const requestAuth = () => {
      console.log('[useParentAuth] Sending REQUEST_AUTH to parent');
      window.parent.postMessage({
        type: 'REQUEST_AUTH'
      }, 'https://buntinggpt.com');
    };

    // Request immediately
    requestAuth();

    // Retry a few times in case of race condition
    const retryInterval = setInterval(() => {
      if (!authAttempted.current) {
        requestAuth();
      } else {
        clearInterval(retryInterval);
      }
    }, 1000);

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(retryInterval);
      if (!authAttempted.current) {
        console.warn('[useParentAuth] Auth timeout - no response from parent');
        setError('Authentication timeout - parent did not respond');
        setIsLoading(false);
      }
    }, 10000);

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
