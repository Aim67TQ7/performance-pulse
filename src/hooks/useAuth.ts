import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isEmbedded } from '@/integrations/supabase/client';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmbedded: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    isEmbedded,
  });

  useEffect(() => {
    // Handle postMessage from parent for embedded apps
    const handleMessage = async (event: MessageEvent) => {
      // Only accept from buntinggpt.com domains
      if (!event.origin.endsWith('.buntinggpt.com') && 
          event.origin !== 'https://buntinggpt.com') {
        return;
      }

      // Handle new consolidated format
      if (event.data?.type === 'BUNTINGGPT_AUTH_TOKEN' && 
          event.data.accessToken && 
          event.data.refreshToken) {
        
        console.log('[Embedded Auth] Received tokens from parent');
        
        const { data, error } = await supabase.auth.setSession({
          access_token: event.data.accessToken,
          refresh_token: event.data.refreshToken
        });

        if (!error && data.session) {
          // Validate RLS context
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id === data.session.user.id) {
            console.log('[Embedded Auth] RLS context validated ✓');
            setAuthState({
              user: data.session.user,
              session: data.session,
              isLoading: false,
              isAuthenticated: true,
              isEmbedded,
            });
          }
        } else if (error) {
          console.error('[Embedded Auth] Failed to set session:', error);
        }
      }

      // Handle legacy format
      if (event.data?.type === 'PROVIDE_TOKEN' && 
          event.data.access_token && 
          event.data.refresh_token) {
        
        console.log('[Embedded Auth] Received legacy token format from parent');
        
        const { data, error } = await supabase.auth.setSession({
          access_token: event.data.access_token,
          refresh_token: event.data.refresh_token
        });

        if (!error && data.session) {
          setAuthState({
            user: data.session.user,
            session: data.session,
            isLoading: false,
            isAuthenticated: true,
            isEmbedded,
          });
        }
      }
    };

    // Add message listener for embedded apps
    if (isEmbedded) {
      window.addEventListener('message', handleMessage);
      
      // Request auth from parent
      window.parent.postMessage({ type: 'REQUEST_TOKEN' }, '*');
      window.parent.postMessage({ type: 'REQUEST_USER' }, '*');
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthContext] Auth state change:', event);
        
        if (session) {
          console.log('[AuthContext] Token diagnostics:', {
            event,
            hasAccessToken: !!session.access_token,
            accessTokenLength: session.access_token?.length || 0,
            hasRefreshToken: !!session.refresh_token,
            refreshTokenLength: session.refresh_token?.length || 0,
            refreshTokenValid: (session.refresh_token?.length || 0) > 20
          });
        }
        
        setAuthState({
          user: session?.user ?? null,
          session: session,
          isLoading: false,
          isAuthenticated: !!session?.user,
          isEmbedded,
        });
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        session: session,
        isLoading: false,
        isAuthenticated: !!session?.user,
        isEmbedded,
      });
    });

    return () => {
      subscription.unsubscribe();
      if (isEmbedded) {
        window.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const redirectToLogin = useCallback(() => {
    // Don't redirect if embedded - parent handles auth
    if (isEmbedded) {
      console.log('[Auth] Embedded app - waiting for parent auth');
      return;
    }
    
    // Redirect to main buntinggpt.com login with return URL
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://buntinggpt.com/login?redirect=${returnUrl}`;
  }, []);

  return {
    ...authState,
    signOut,
    redirectToLogin,
  };
};
