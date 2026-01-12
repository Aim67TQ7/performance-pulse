/**
 * AuthContext for BuntingGPT Subdomain Apps
 * 
 * Simplified AuthContext for subdomain apps that:
 * 1. Works with useParentAuth for embedded mode
 * 2. Provides standard Supabase auth for standalone mode
 */

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  sessionChecked: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  sessionChecked: false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    console.log('[AuthContext] Initializing auth context...', {
      timestamp: new Date().toISOString()
    });

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;

        console.log('[AuthContext] Auth state change:', {
          event,
          userId: currentSession?.user?.id,
          email: currentSession?.user?.email,
          expiresAt: currentSession?.expires_at,
          hasAccessToken: !!currentSession?.access_token,
          tokenExpiry: currentSession?.expires_at 
            ? new Date(currentSession.expires_at * 1000).toISOString() 
            : null,
          timestamp: new Date().toISOString()
        });

        if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] User signed out, clearing state');
          setSession(null);
          setUser(null);
        } else if (currentSession) {
          console.log('[AuthContext] Setting session and user:', {
            userId: currentSession.user?.id,
            email: currentSession.user?.email
          });
          setSession(currentSession);
          setUser(currentSession.user);
        }

        // Mark session as checked after any auth event
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          console.log('[AuthContext] Session checked, setting loading false');
          setSessionChecked(true);
          setIsLoading(false);
        }
      }
    );

    // Then check for existing session
    const initializeAuth = async () => {
      try {
        console.log('[AuthContext] Calling getSession...');
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        console.log('[AuthContext] getSession result:', {
          hasSession: !!existingSession,
          userId: existingSession?.user?.id,
          email: existingSession?.user?.email,
          error: error?.message,
          timestamp: new Date().toISOString()
        });
        
        if (mounted) {
          if (existingSession) {
            setSession(existingSession);
            setUser(existingSession.user);
          }
          setSessionChecked(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[AuthContext] Error getting session:', error);
        if (mounted) {
          setSessionChecked(true);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      sessionChecked,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
