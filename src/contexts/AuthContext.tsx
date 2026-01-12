/**
 * AuthContext for BuntingGPT Subdomain Apps
 * 
 * Wraps useParentAuth to provide a single source of truth for auth state.
 * Works seamlessly in both embedded (iframe) and standalone modes.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useParentAuth, ParentAuthState } from '@/hooks/useParentAuth';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType extends ParentAuthState {
  // Additional context-specific properties can be added here
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useParentAuth();

  // Import supabase for signOut
  const signOut = async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ ...auth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
