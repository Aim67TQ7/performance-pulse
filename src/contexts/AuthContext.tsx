/**
 * AuthContext for BuntingGPT Subdomain Apps
 * 
 * Uses useBuntingAuth for cookie-based authentication across all *.buntinggpt.com subdomains.
 * Works seamlessly in both embedded (iframe) and standalone modes.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useBuntingAuth, UseBuntingAuthReturn } from '@/hooks/useBuntingAuth';

type AuthContextType = UseBuntingAuthReturn;

// Default context value for when accessed outside provider
const defaultContextValue: AuthContextType = {
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  isEmbedded: false,
  authReceived: false,
  error: null,
  requestAuth: () => {},
  displayName: null,
  email: null,
  login: () => {},
  logout: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultContextValue);

export const useAuth = () => {
  return useContext(AuthContext);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Don't auto-redirect at context level - let PrivateRoute handle that
  const auth = useBuntingAuth({ requireAuth: false });

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}
