import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const PARENT_ORIGIN = 'https://buntinggpt.com';
const AUTH_REDIRECT_URL = 'https://buntinggpt.com/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  employeeId: string | null;
  isLoading: boolean;
  isEmbedded: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function checkIsEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isValidOrigin(origin: string): boolean {
  return (
    origin === PARENT_ORIGIN ||
    origin.endsWith('.buntinggpt.com') ||
    origin === 'http://localhost:3000' ||
    origin === 'http://localhost:5173' ||
    origin === 'http://localhost:8080'
  );
}

interface TokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

interface PostMessageData {
  type: string;
  payload?: TokenPayload;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmbedded] = useState(() => checkIsEmbedded());

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setEmployeeId(null);
  }, []);

  // Lookup employeeId from the employees table based on user_id
  const lookupEmployeeId = useCallback(async (userId: string): Promise<string | null> => {
    try {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      return employee?.id || null;
    } catch (error) {
      console.error('[AuthContext] Failed to lookup employeeId:', error);
      return null;
    }
  }, []);

  const handleTokenMessage = useCallback(async (event: MessageEvent<PostMessageData>) => {
    if (!isValidOrigin(event.origin)) return;
    const { type, payload } = event.data;

    if (type === 'PROVIDE_TOKEN' && payload) {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: payload.accessToken,
          refresh_token: payload.refreshToken,
        });

        if (error) {
          window.parent.postMessage({ type: 'AUTH_ERROR', payload: { error: error.message } }, event.origin);
          return;
        }

        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          
          // Lookup employeeId
          const empId = await lookupEmployeeId(data.session.user.id);
          setEmployeeId(empId);
          
          window.parent.postMessage({ type: 'AUTH_READY', payload: { userId: data.session.user.id } }, event.origin);
        }
      } catch (err) {
        window.parent.postMessage({ type: 'AUTH_ERROR', payload: { error: 'Failed to set session' } }, event.origin);
      } finally {
        setIsLoading(false);
      }
    }
  }, [lookupEmployeeId]);

  useEffect(() => {
    if (isEmbedded) {
      window.addEventListener('message', handleTokenMessage);
      if (window.parent) window.parent.postMessage({ type: 'REQUEST_TOKEN' }, '*');

      const timeout = setTimeout(() => {
        if (isLoading) setIsLoading(false);
      }, 5000);

      return () => {
        window.removeEventListener('message', handleTokenMessage);
        clearTimeout(timeout);
      };
    } else {
      const initStandaloneAuth = async () => {
        try {
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            
            if (newSession?.user) {
              const empId = await lookupEmployeeId(newSession.user.id);
              setEmployeeId(empId);
            } else {
              setEmployeeId(null);
            }
          });

          const { data: { session: existingSession } } = await supabase.auth.getSession();

          if (existingSession) {
            setSession(existingSession);
            setUser(existingSession.user);
            
            // Lookup employeeId
            const empId = await lookupEmployeeId(existingSession.user.id);
            setEmployeeId(empId);
            setIsLoading(false);
          } else {
            // No session - redirect to auth
            window.location.href = AUTH_REDIRECT_URL;
            return;
          }

          return () => subscription.unsubscribe();
        } catch (err) {
          console.error('[AuthContext] Auth initialization error:', err);
          window.location.href = AUTH_REDIRECT_URL;
        }
      };

      initStandaloneAuth();
    }
  }, [isEmbedded, handleTokenMessage, isLoading, lookupEmployeeId]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
        const empId = await lookupEmployeeId(newSession.user.id);
        setEmployeeId(empId);
      } else {
        setEmployeeId(null);
      }
      
      if (event === 'SIGNED_OUT' && isEmbedded && window.parent) {
        window.parent.postMessage({ type: 'REQUEST_TOKEN' }, '*');
      }
    });

    return () => subscription.unsubscribe();
  }, [isEmbedded, lookupEmployeeId]);

  return (
    <AuthContext.Provider value={{ user, session, employeeId, isLoading, isEmbedded, signOut }}>
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
