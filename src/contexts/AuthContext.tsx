import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { readSession, clearSession, ensureCleanAuthState, purgeAllAuthCookies } from '@/lib/supabase-storage';

// Gate URL for OAuth
const GATE_URL = 'https://gate.buntinggpt.com';
const SELF_URL = 'https://self.buntinggpt.com';

// LocalStorage keys for local auth
const AUTH_TOKEN_KEY = 'pep_auth_token';
const TEMP_TOKEN_KEY = 'pep_temp_token';
const EMPLOYEE_KEY = 'pep_employee';

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

export interface LoginResult {
  success: boolean;
  error?: string;
  requiresPasswordSetup?: boolean;
  mustSetPassword?: boolean;
}

export interface SetPasswordResult {
  success: boolean;
  error?: string;
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

type AuthMethod = 'sso' | 'email' | 'badge' | null;

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
  loginWithEmail: (email: string, password: string) => Promise<LoginResult>;
  loginWithBadge: (badgeNumber: string, pin: string) => Promise<LoginResult>;
  setPassword: (newPassword: string, currentPassword?: string) => Promise<SetPasswordResult>;
  // Legacy method alias
  login: (email: string, password: string) => Promise<LoginResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Supabase URL for employee lookup
const SUPABASE_URL = "https://qzwxisdfwswsrbzvpzlo.supabase.co";
const AUTH_API_URL = `${SUPABASE_URL}/functions/v1/employee-auth`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [session, setSession] = useState<GateSession | null>(null);
  const [internalToken, setInternalToken] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!employee && !!internalToken && !tempToken;
  const employeeId = employee?.id || null;
  const token = internalToken;

  // Verify SSO email and get internal JWT + employee data from edge function
  const verifySsoAndGetToken = useCallback(async (email: string): Promise<{ token: string; employee: Employee } | null> => {
    try {
      console.log('[AuthContext] Verifying SSO email via employee-auth/sso-verify:', email);
      
      const response = await fetch(`${AUTH_API_URL}/sso-verify`, {
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

  // Verify token from localStorage
  const verifyToken = useCallback(async (storedToken: string): Promise<{ employee: Employee; mustSetPassword?: boolean } | null> => {
    try {
      console.log('[AuthContext] Verifying token...');
      
      const response = await fetch(`${AUTH_API_URL}/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid && data.employee) {
          console.log('[AuthContext] Token valid for:', data.employee.name_first);
          return { 
            employee: data.employee as Employee,
            mustSetPassword: data.must_set_password 
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[AuthContext] Error verifying token:', error);
      return null;
    }
  }, []);

  // Initialize from cookies (SSO) or localStorage (email/badge)
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('[AuthContext] Initializing auth...');
        
        // Check for temp token (password setup in progress)
        const storedTempToken = localStorage.getItem(TEMP_TOKEN_KEY);
        const storedEmployee = localStorage.getItem(EMPLOYEE_KEY);
        
        if (storedTempToken && storedEmployee) {
          console.log('[AuthContext] Found temp token - user needs to set password');
          setTempToken(storedTempToken);
          setInternalToken(storedTempToken);
          setEmployee(JSON.parse(storedEmployee));
          setAuthMethod('email');
          setIsLoading(false);
          return;
        }
        
        // Check SSO session from cookies
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
        
        // Check local auth token from localStorage
        const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
        if (authToken) {
          const result = await verifyToken(authToken);
          
          if (result) {
            setEmployee(result.employee);
            setInternalToken(authToken);
            setAuthMethod('email');
            
            // Check if password reset is required
            if (result.mustSetPassword) {
              console.log('[AuthContext] User must set password');
              setTempToken(authToken);
              localStorage.setItem(TEMP_TOKEN_KEY, authToken);
              localStorage.removeItem(AUTH_TOKEN_KEY);
            }
            
            console.log('[AuthContext] Local auth complete for:', result.employee.name_first);
            setIsLoading(false);
            return;
          } else {
            // Invalid token, clear it
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(EMPLOYEE_KEY);
          }
        }

        console.log('[AuthContext] No valid session found');
      } catch (error) {
        console.error('[AuthContext] Init error:', error);
        clearSession();
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(TEMP_TOKEN_KEY);
        localStorage.removeItem(EMPLOYEE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [verifySsoAndGetToken, verifyToken]);

  // Login with email and password
  const loginWithEmail = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      console.log('[AuthContext] Attempting email login for:', email);
      
      const response = await fetch(`${AUTH_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { 
          success: false, 
          error: data.error || 'Login failed' 
        };
      }

      // First-time login - no password set
      if (data.requires_password_setup) {
        setTempToken(data.temp_token);
        setInternalToken(data.temp_token);
        setEmployee(data.employee);
        localStorage.setItem(TEMP_TOKEN_KEY, data.temp_token);
        localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));
        return { success: true, requiresPasswordSetup: true };
      }

      // Successful login
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));
      localStorage.removeItem(TEMP_TOKEN_KEY);
      setEmployee(data.employee);
      setInternalToken(data.token);
      setTempToken(null);
      setAuthMethod('email');

      // Check if must change default password
      if (data.must_set_password) {
        setTempToken(data.token);
        localStorage.setItem(TEMP_TOKEN_KEY, data.token);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        return { success: true, mustSetPassword: true };
      }

      console.log('[AuthContext] Email login successful for:', data.employee.name_first);
      return { success: true };
    } catch (error) {
      console.error('[AuthContext] Email login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  // Login with badge number and PIN
  const loginWithBadge = useCallback(async (badgeNumber: string, pin: string): Promise<LoginResult> => {
    try {
      console.log('[AuthContext] Attempting badge login for:', badgeNumber);
      
      const response = await fetch(`${AUTH_API_URL}/badge-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ badge_number: badgeNumber, pin }),
      });

      const data = await response.json();

      if (response.ok && data.token && data.employee) {
        // Store token and employee in localStorage
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));
        localStorage.removeItem(TEMP_TOKEN_KEY);
        
        setEmployee(data.employee as Employee);
        setInternalToken(data.token);
        setTempToken(null);
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

  // Set or change password
  const setPasswordFn = useCallback(async (newPassword: string, currentPassword?: string): Promise<SetPasswordResult> => {
    const tokenToUse = tempToken || internalToken;
    
    if (!tokenToUse) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${AUTH_API_URL}/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`,
        },
        body: JSON.stringify({ 
          new_password: newPassword,
          current_password: currentPassword 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to set password' };
      }

      // Update with new token
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));
      localStorage.removeItem(TEMP_TOKEN_KEY);
      setEmployee(data.employee);
      setInternalToken(data.token);
      setTempToken(null);

      return { success: true };
    } catch (error) {
      console.error('[AuthContext] Set password error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [tempToken, internalToken]);

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
    
    // Clear local session
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(TEMP_TOKEN_KEY);
    localStorage.removeItem(EMPLOYEE_KEY);
    
    setEmployee(null);
    setSession(null);
    setInternalToken(null);
    setTempToken(null);
    setAuthMethod(null);
    
    // Redirect to login page
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ 
      employee, 
      employeeId, 
      isLoading, 
      isAuthenticated,
      authMethod,
      tempToken,
      token,
      session,
      signIn,
      signOut,
      loginWithEmail,
      loginWithBadge,
      setPassword: setPasswordFn,
      login: loginWithEmail, // Legacy alias
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
