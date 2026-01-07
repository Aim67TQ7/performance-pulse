import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isEmbedded } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isEmbedded: boolean;
  authSource: 'cookie' | 'postMessage' | null;
  signOut: () => Promise<void>;
  redirectToLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authSource, setAuthSource] = useState<'cookie' | 'postMessage' | null>(null);

  useEffect(() => {
    // Handle postMessage from parent for embedded apps
    const handleMessage = async (event: MessageEvent) => {
      // Only accept from buntinggpt.com domains
      if (!event.origin.endsWith('.buntinggpt.com') && 
          event.origin !== 'https://buntinggpt.com') {
        return;
      }

      // Handle new consolidated format
      if (event.data?.type === 'BUNTINGGPT_AUTH_TOKEN' && 
          event.data.accessToken && 
          event.data.refreshToken) {
        
        console.log('[AuthContext] Received tokens from parent');
        
        const { data, error } = await supabase.auth.setSession({
          access_token: event.data.accessToken,
          refresh_token: event.data.refreshToken
        });

        if (!error && data.session) {
          // Validate RLS context
          const { data: { user: validatedUser } } = await supabase.auth.getUser();
          if (validatedUser?.id === data.session.user.id) {
            console.log('[AuthContext] RLS context validated ✓');
            setUser(data.session.user);
            setSession(data.session);
            setAuthSource('postMessage');
            setIsLoading(false);
          }
        } else if (error) {
          console.error('[AuthContext] Failed to set session:', error);
        }
      }

      // Handle legacy format
      if (event.data?.type === 'PROVIDE_TOKEN' && 
          event.data.access_token && 
          event.data.refresh_token) {
        
        console.log('[AuthContext] Received legacy token format from parent');
        
        const { data, error } = await supabase.auth.setSession({
          access_token: event.data.access_token,
          refresh_token: event.data.refresh_token
        });

        if (!error && data.session) {
          setUser(data.session.user);
          setSession(data.session);
          setAuthSource('postMessage');
          setIsLoading(false);
        }
      }
    };

    // Add message listener for embedded apps
    if (isEmbedded) {
      window.addEventListener('message', handleMessage);
      
      // Request auth from parent
      window.parent.postMessage({ 
        type: 'REQUEST_TOKEN',
        origin: window.location.origin,
        timestamp: Date.now()
      }, '*');
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('[AuthContext] Auth state change:', event);
        
        if (currentSession) {
          setUser(currentSession.user);
          setSession(currentSession);
          if (!authSource) {
            setAuthSource('cookie');
          }
        } else {
          setUser(null);
          setSession(null);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (existingSession) {
        setUser(existingSession.user);
        setSession(existingSession);
        setAuthSource('cookie');
      }
      setIsLoading(false);
    });

    // 5-second timeout for embedded apps waiting for parent auth
    let timeoutId: NodeJS.Timeout;
    if (isEmbedded) {
      timeoutId = setTimeout(() => {
        if (isLoading) {
          console.log('[AuthContext] Timeout waiting for parent auth');
          setIsLoading(false);
        }
      }, 5000);
    }

    return () => {
      subscription.unsubscribe();
      if (isEmbedded) {
        window.removeEventListener('message', handleMessage);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAuthSource(null);
  }, []);

  const redirectToLogin = useCallback(() => {
    // Don't redirect if embedded - parent handles auth
    if (isEmbedded) {
      console.log('[AuthContext] Embedded app - waiting for parent auth');
      return;
    }
    
    // Redirect to main buntinggpt.com login with return URL
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `https://buntinggpt.com/login?redirect=${returnUrl}`;
  }, []);

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    isEmbedded,
    authSource,
    signOut,
    redirectToLogin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};