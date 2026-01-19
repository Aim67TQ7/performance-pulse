import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { readSession, writeSession, clearSession, hasSession } from '@/lib/cookieSession';

// Gate URL for OAuth
const GATE_URL = 'https://gate.buntinggpt.com';
const SELF_URL = 'https://self.buntinggpt.com';

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

interface AuthContextType {
  employee: Employee | null;
  employeeId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  tempToken: string | null;
  token: string | null;
  session: GateSession | null;
  signIn: () => void;
  signOut: () => void;
  // Legacy methods (for compatibility, but will redirect to gate)
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
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!employee && !!session;
  const employeeId = employee?.id || null;
  // Use internal JWT for edge functions, not the OAuth token
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

  // Initialize from cookies
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('[AuthContext] Initializing auth...');
        
        // Read session from chunked cookies
        const storedSession = readSession<GateSession>();
        
        if (storedSession && storedSession.access_token && storedSession.user) {
          console.log('[AuthContext] Found session for:', storedSession.user.email);
          
          // Check if session is expired
          if (storedSession.expires_at && Date.now() / 1000 > storedSession.expires_at) {
            console.log('[AuthContext] Session expired, clearing...');
            clearSession();
            setIsLoading(false);
            return;
          }
          
          setSession(storedSession);
          
          // Call SSO verify endpoint to get internal JWT and employee data
          const ssoResult = await verifySsoAndGetToken(storedSession.user.email);
          
          if (ssoResult) {
            setEmployee(ssoResult.employee);
            setInternalToken(ssoResult.token);
            console.log('[AuthContext] Employee loaded via SSO bridge:', ssoResult.employee.name_first, ssoResult.employee.name_last);
            console.log('[AuthContext] Internal token set for edge function calls');
          } else {
            console.warn('[AuthContext] No employee record found for SSO email:', storedSession.user.email);
            // Do NOT create minimal employee - this would cause benefit_class to be null
            // and block access to evaluation. User must have an employee record.
            setEmployee(null);
            setInternalToken(null);
          }
        } else {
          console.log('[AuthContext] No valid session found');
        }
      } catch (error) {
        console.error('[AuthContext] Init error:', error);
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [verifySsoAndGetToken]);

  // Redirect to gate for sign-in
  const signIn = useCallback(() => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : SELF_URL;
    const returnUrl = encodeURIComponent(currentUrl);
    window.location.href = `${GATE_URL}/auth?redirect=${returnUrl}`;
  }, []);

  // Sign out and redirect to gate
  const signOut = useCallback(() => {
    clearSession();
    setEmployee(null);
    setSession(null);
    setInternalToken(null);
    
    // Redirect directly to gate
    window.location.href = GATE_URL;
  }, []);

  // Legacy login method - redirects to gate
  const login = useCallback(async (_email: string, _password: string) => {
    signIn();
    return { success: false, error: 'Redirecting to sign-in...' };
  }, [signIn]);

  // Legacy setPassword method - not supported with SSO
  const setPassword = useCallback(async (_newPassword: string, _currentPassword?: string) => {
    return { success: false, error: 'Password management is handled by your organization' };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      employee, 
      employeeId, 
      isLoading, 
      isAuthenticated,
      tempToken: null, // Not used with SSO
      token,
      session,
      signIn,
      signOut,
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
