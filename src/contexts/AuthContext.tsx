/**
 * AuthContext for BuntingGPT Subdomain Apps
 * 
 * Wraps useParentAuth to provide a single source of truth for auth state.
 * Works seamlessly in both embedded (iframe) and standalone modes.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useParentAuth, ParentAuthState } from '@/hooks/useParentAuth';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType extends ParentAuthState {
  signOut: () => Promise<void>;
}

// Default context value for when accessed outside provider (should not happen in normal use)
const defaultContextValue: AuthContextType = {
  user: null,
  session: null,
  isLoading: true,
  isEmbedded: false,
  authReceived: false,
  error: null,
  requestAuth: () => {},
  signOut: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultContextValue);

export const useAuth = () => {
  return useContext(AuthContext);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useParentAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ ...auth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
