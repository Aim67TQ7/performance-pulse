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
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!employee && !!session;
  const employeeId = employee?.id || null;
  const token = session?.access_token || null;

  // Fetch employee data from Supabase using email
  const fetchEmployee = useCallback(async (email: string, accessToken: string): Promise<Employee | null> => {
    try {
      // Query the team-hierarchy endpoint to get employee data
      // This uses our existing edge function that can look up by email
      const response = await fetch(`${SUPABASE_URL}/functions/v1/team-hierarchy/verify-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.employee) {
          return data.employee;
        }
      }

      // Fallback: Query employees table directly via REST API
      const restResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/employees?user_email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=*`,
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6d3hpc2Rmd3N3c3JienZwemxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1OTE3MDUsImV4cCI6MjA0NzE2NzcwNX0.EML4gM9VOFB6OofnuCnypxBldOVXj9z6oPX4J_LPFJI',
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (restResponse.ok) {
        const employees = await restResponse.json();
        if (employees && employees.length > 0) {
          const emp = employees[0];
          return {
            id: emp.id,
            name_first: emp.name_first,
            name_last: emp.name_last,
            user_email: emp.user_email,
            job_title: emp.job_title,
            department: emp.department,
            job_level: emp.job_level,
            location: emp.location,
            business_unit: emp.business_unit,
            benefit_class: emp.benefit_class,
            hire_date: emp.hire_date,
            employee_number: emp.employee_number,
            badge_number: emp.badge_number,
            reports_to: emp.reports_to,
            supervisor_name: null, // Would need another query
            is_hr_admin: emp.is_hr_admin || false,
          };
        }
      }

      console.warn('[AuthContext] No employee found for email:', email);
      return null;
    } catch (error) {
      console.error('[AuthContext] Error fetching employee:', error);
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
          
          // Fetch employee data
          const emp = await fetchEmployee(storedSession.user.email, storedSession.access_token);
          if (emp) {
            setEmployee(emp);
            console.log('[AuthContext] Employee loaded:', emp.name_first, emp.name_last);
          } else {
            console.warn('[AuthContext] No employee record found, but session is valid');
            // Create a minimal employee from session data
            const nameParts = (storedSession.user.user_metadata?.full_name || storedSession.user.user_metadata?.name || storedSession.user.email).split(' ');
            setEmployee({
              id: storedSession.user.id,
              name_first: nameParts[0] || '',
              name_last: nameParts.slice(1).join(' ') || '',
              user_email: storedSession.user.email,
              job_title: null,
              department: null,
              job_level: null,
              location: null,
              business_unit: null,
              benefit_class: null,
              hire_date: null,
              employee_number: null,
              badge_number: null,
              reports_to: null,
              supervisor_name: null,
              is_hr_admin: false,
            });
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
  }, [fetchEmployee]);

  // Redirect to gate for sign-in
  const signIn = useCallback(() => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : SELF_URL;
    const returnUrl = encodeURIComponent(currentUrl);
    window.location.href = `${GATE_URL}/auth?redirect=${returnUrl}`;
  }, []);

  // Sign out and clear cookies
  const signOut = useCallback(() => {
    clearSession();
    setEmployee(null);
    setSession(null);
    
    // Redirect to gate to sign out there too
    const returnUrl = encodeURIComponent(SELF_URL);
    window.location.href = `${GATE_URL}/auth/signout?redirect=${returnUrl}`;
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
