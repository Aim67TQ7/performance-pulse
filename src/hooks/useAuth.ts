import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthState({
          user: session?.user ?? null,
          session: session,
          isLoading: false,
          isAuthenticated: !!session?.user,
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
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const redirectToLogin = useCallback(() => {
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
