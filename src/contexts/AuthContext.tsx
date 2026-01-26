import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { readSession, clearSession, ensureCleanAuthState, purgeAllAuthCookies } from '@/lib/supabase-storage';

// Gate URL for OAuth
const GATE_URL = 'https://gate.buntinggpt.com';
const SELF_URL = 'https://self.buntinggpt.com';

// LocalStorage keys for badge auth
const BADGE_TOKEN_KEY = 'pep_auth_token';
const BADGE_EMPLOYEE_KEY = 'pep_employee';

export interface Employee {
  id: string;
  name_first: string;
  name_last: string;
  user_email: string;
  job_title: string | null;
  department: string | null;
  job_level: string | null;
  location: string | null;
  business_unit: string | null;
  benefit_class: string | null;
  hire_date: string | null;
  employee_number: string | null;
  badge_number: string | null;
  reports_to: string | null;
  supervisor_name: string | null;
  is_hr_admin: boolean;
}

// Session data from gate.buntinggpt.com
interface GateSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
      avatar_url?: string;
    };
  };
}

type AuthMethod = 'sso' | 'badge' | null;

interface AuthContextType {
  employee: Employee | null;
  employeeId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authMethod: AuthMethod;
  tempToken: string | null;
  token: string | null;
  session: GateSession | null;
  signIn: () => void;
  signOut: () => void;
  loginWithBadge: (badgeNumber: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  // Legacy methods (for compatibility)
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  setPassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Supabase URL for employee lookup
const SUPABASE_URL = "https://qzwxisdfwswsrbzvpzlo.supabase.co";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [session, setSession] = useState<GateSession | null>(null);
  const [internalToken, setInternalToken] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!employee && !!internalToken;
  const employeeId = employee?.id || null;
  const token = internalToken;

  // Verify SSO email and get internal JWT + employee data from edge function
  const verifySsoAndGetToken = useCallback(async (email: string): Promise<{ token: string; employee: Employee } | null> => {
    try {
      console.log('[AuthContext] Verifying SSO email via employee-auth/sso-verify:', email);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/employee-auth/sso-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token && data.employee) {
          console.log('[AuthContext] SSO verification successful for:', email);
          return {
            token: data.token,
            employee: data.employee as Employee,
          };
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[AuthContext] SSO verification failed:', response.status, errorData);
      }

      return null;
    } catch (error) {
      console.error('[AuthContext] Error verifying SSO:', error);
      return null;
    }
  }, []);

  // Verify badge token from localStorage
  const verifyBadgeToken = useCallback(async (storedToken: string): Promise<{ employee: Employee } | null> => {
    try {
      console.log('[AuthContext] Verifying badge token...');
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/employee-auth/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.employee) {
          console.log('[AuthContext] Badge token valid for:', data.employee.name_first);
          return { employee: data.employee as Employee };
        }
      }

      return null;
    } catch (error) {
      console.error('[AuthContext] Error verifying badge token:', error);
      return null;
    }
  }, []);

  // Initialize from cookies (SSO) or localStorage (badge)
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('[AuthContext] Initializing auth...');
        
        // First check SSO session from cookies
        const hasValidSsoToken = ensureCleanAuthState();
        if (hasValidSsoToken) {
          const storedSession = readSession<GateSession>();
          
          if (storedSession && storedSession.access_token && storedSession.user) {
            console.log('[AuthContext] Found SSO session for:', storedSession.user.email);
            
            // Check if session is expired
            if (storedSession.expires_at && Date.now() / 1000 > storedSession.expires_at) {
              console.log('[AuthContext] SSO session expired, clearing...');
              clearSession();
            } else {
              setSession(storedSession);
              
              // Call SSO verify endpoint to get internal JWT and employee data
              const ssoResult = await verifySsoAndGetToken(storedSession.user.email);
              
              if (ssoResult) {
                setEmployee(ssoResult.employee);
                setInternalToken(ssoResult.token);
                setAuthMethod('sso');
                console.log('[AuthContext] SSO auth complete for:', ssoResult.employee.name_first);
                setIsLoading(false);
                return;
              } else {
                console.warn('[AuthContext] No employee record found for SSO email');
              }
            }
          }
        }
        
        // Then check badge token from localStorage
        const badgeToken = localStorage.getItem(BADGE_TOKEN_KEY);
        if (badgeToken) {
          const badgeResult = await verifyBadgeToken(badgeToken);
          
          if (badgeResult) {
            setEmployee(badgeResult.employee);
            setInternalToken(badgeToken);
            setAuthMethod('badge');
            console.log('[AuthContext] Badge auth complete for:', badgeResult.employee.name_first);
            setIsLoading(false);
            return;
          } else {
            // Invalid token, clear it
            localStorage.removeItem(BADGE_TOKEN_KEY);
            localStorage.removeItem(BADGE_EMPLOYEE_KEY);
          }
        }

        console.log('[AuthContext] No valid session found');
      } catch (error) {
        console.error('[AuthContext] Init error:', error);
        clearSession();
        localStorage.removeItem(BADGE_TOKEN_KEY);
        localStorage.removeItem(BADGE_EMPLOYEE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [verifySsoAndGetToken, verifyBadgeToken]);

  // Login with badge number and PIN
  const loginWithBadge = useCallback(async (badgeNumber: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[AuthContext] Attempting badge login for:', badgeNumber);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/employee-auth/badge-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ badge_number: badgeNumber, pin }),
      });

      const data = await response.json();

      if (response.ok && data.token && data.employee) {
        // Store token and employee in localStorage
        localStorage.setItem(BADGE_TOKEN_KEY, data.token);
        localStorage.setItem(BADGE_EMPLOYEE_KEY, JSON.stringify(data.employee));
        
        setEmployee(data.employee as Employee);
        setInternalToken(data.token);
        setAuthMethod('badge');
        
        console.log('[AuthContext] Badge login successful for:', data.employee.name_first);
        return { success: true };
      }

      return { 
        success: false, 
        error: data.error || 'Login failed' 
      };
    } catch (error) {
      console.error('[AuthContext] Badge login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  // Redirect to gate for SSO sign-in
  const signIn = useCallback(() => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : SELF_URL;
    const returnUrl = encodeURIComponent(currentUrl);
    window.location.href = `${GATE_URL}/auth?redirect=${returnUrl}`;
  }, []);

  // Sign out and clear all session data
  const signOut = useCallback(() => {
    // Clear SSO session
    purgeAllAuthCookies();
    
    // Clear badge session
    localStorage.removeItem(BADGE_TOKEN_KEY);
    localStorage.removeItem(BADGE_EMPLOYEE_KEY);
    
    setEmployee(null);
    setSession(null);
    setInternalToken(null);
    setAuthMethod(null);
    
    // Redirect to login page
    window.location.href = '/login';
  }, []);

  // Legacy login method - use badge login
  const login = useCallback(async (email: string, password: string) => {
    // For legacy compatibility, try badge login if email looks like a badge number
    if (email && password) {
      return loginWithBadge(email, password);
    }
    return { success: false, error: 'Invalid credentials' };
  }, [loginWithBadge]);

  // Legacy setPassword method
  const setPassword = useCallback(async (_newPassword: string, _currentPassword?: string) => {
    return { success: false, error: 'Password management is handled by your administrator' };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      employee, 
      employeeId, 
      isLoading, 
      isAuthenticated,
      authMethod,
      tempToken: null,
      token,
      session,
      signIn,
      signOut,
      loginWithBadge,
      login,
      setPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
