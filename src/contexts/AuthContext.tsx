import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AUTH_TOKEN_KEY = 'pep_auth_token';
const TEMP_TOKEN_KEY = 'pep_temp_token';
const EMPLOYEE_KEY = 'pep_employee';

// Use relative URL for edge functions (works with Supabase client)
const SUPABASE_URL = "https://qzwxisdfwswsrbzvpzlo.supabase.co";
const AUTH_API_URL = `${SUPABASE_URL}/functions/v1/employee-auth`;

export interface Employee {
  id: string;
  name_first: string;
  name_last: string;
  user_email: string;
  job_title: string | null;
  department: string | null;
  job_level: string | null;
  reports_to?: string;
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

interface AuthContextType {
  employee: Employee | null;
  employeeId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  tempToken: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  setPassword: (newPassword: string, currentPassword?: string) => Promise<SetPasswordResult>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tempToken, setTempToken] = useState<string | null>(null);

  const isAuthenticated = !!employee && !tempToken;
  const employeeId = employee?.id || null;

  // Initialize from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
        const storedTempToken = localStorage.getItem(TEMP_TOKEN_KEY);
        const storedEmployee = localStorage.getItem(EMPLOYEE_KEY);

        if (storedTempToken && storedEmployee) {
          // User has temp token - needs to set password
          setTempToken(storedTempToken);
          setEmployee(JSON.parse(storedEmployee));
          setIsLoading(false);
          return;
        }

        if (storedToken) {
          // Verify token is still valid
          const response = await fetch(`${AUTH_API_URL}/verify-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedToken}`
            }
          });

          const data = await response.json();

          if (data.valid && data.employee) {
            setEmployee(data.employee);
            localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));
            
            // Check if password reset is required
            if (data.must_set_password) {
              setTempToken(storedToken);
              localStorage.setItem(TEMP_TOKEN_KEY, storedToken);
              localStorage.removeItem(AUTH_TOKEN_KEY);
            }
          } else {
            // Token invalid - clear storage
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(EMPLOYEE_KEY);
          }
        }
      } catch (error) {
        console.error('[AuthContext] Init error:', error);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(EMPLOYEE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const response = await fetch(`${AUTH_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
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
      setTempToken(null);

      if (data.must_set_password) {
        setTempToken(data.token);
        localStorage.setItem(TEMP_TOKEN_KEY, data.token);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        return { success: true, mustSetPassword: true };
      }

      return { success: true };
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, []);

  const setPasswordFn = useCallback(async (newPassword: string, currentPassword?: string): Promise<SetPasswordResult> => {
    const token = tempToken || localStorage.getItem(AUTH_TOKEN_KEY);
    
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${AUTH_API_URL}/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          new_password: newPassword,
          current_password: currentPassword 
        })
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
      setTempToken(null);

      return { success: true };
    } catch (error) {
      console.error('[AuthContext] Set password error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [tempToken]);

  const signOut = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(TEMP_TOKEN_KEY);
    localStorage.removeItem(EMPLOYEE_KEY);
    setEmployee(null);
    setTempToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      employee, 
      employeeId, 
      isLoading, 
      isAuthenticated,
      tempToken,
      login, 
      setPassword: setPasswordFn,
      signOut 
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
