/**
 * TokenContext - Token-Based Access Control
 * 
 * Reads token and employee_id from URL parameters.
 * Verifies token exists in app_items table.
 * Provides employee_id for data queries throughout the app.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TokenContextType {
  isLoading: boolean;
  isValid: boolean;
  employeeId: string | null;
  token: string | null;
  error: string | null;
}

const defaultContextValue: TokenContextType = {
  isLoading: true,
  isValid: false,
  employeeId: null,
  token: null,
  error: null,
};

const TokenContext = createContext<TokenContextType>(defaultContextValue);

export const useToken = () => {
  return useContext(TokenContext);
};

export function TokenProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        // Read token and user_id from URL params
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        const urlUserId = params.get('user_id');

        console.log('[TokenContext] URL params:', { token: urlToken, user_id: urlUserId });

        if (!urlToken) {
          setError('Missing access token');
          setIsLoading(false);
          return;
        }

        if (!urlUserId) {
          setError('Missing user identifier');
          setIsLoading(false);
          return;
        }

        // Verify token exists in app_items table
        const { data: appItem, error: queryError } = await supabase
          .from('app_items')
          .select('id, name')
          .eq('token', urlToken)
          .maybeSingle();

        if (queryError) {
          console.error('[TokenContext] Query error:', queryError);
          setError('Failed to verify access');
          setIsLoading(false);
          return;
        }

        if (!appItem) {
          console.log('[TokenContext] Token not found in app_items');
          setError('Invalid access token');
          setIsLoading(false);
          return;
        }

        console.log('[TokenContext] Token verified for app:', appItem.name);

        // First try: Look up employee by user_id (for salary employees with auth)
        let { data: employee, error: empError } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', urlUserId)
          .maybeSingle();

        // Fallback: If not found by user_id, try by id (for hourly employees)
        if (!employee && !empError) {
          console.log('[TokenContext] user_id lookup failed, trying by id');
          const fallbackResult = await supabase
            .from('employees')
            .select('id')
            .eq('id', urlUserId)
            .maybeSingle();
          
          employee = fallbackResult.data;
          empError = fallbackResult.error;
        }

        if (empError || !employee) {
          console.error('[TokenContext] Employee not found:', empError);
          setError('Invalid user identifier');
          setIsLoading(false);
          return;
        }

        // All valid - store employee.id for internal use
        setToken(urlToken);
        setEmployeeId(employee.id);
        setIsValid(true);
        setIsLoading(false);
      } catch (err) {
        console.error('[TokenContext] Verification error:', err);
        setError('An error occurred during verification');
        setIsLoading(false);
      }
    };

    verifyToken();
  }, []);

  const value: TokenContextType = {
    isLoading,
    isValid,
    employeeId,
    token,
    error,
  };

  return (
    <TokenContext.Provider value={value}>
      {children}
    </TokenContext.Provider>
  );
}
