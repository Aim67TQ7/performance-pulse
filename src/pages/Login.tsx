/**
 * Login Page - Microsoft OAuth Authentication
 * 
 * Standalone login page using Microsoft (Azure AD) as the only authentication method.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Store the intended destination for after login
      const returnUrl = (location.state as { from?: string })?.from || '/';
      sessionStorage.setItem('auth_return_url', returnUrl);

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'openid profile email',
        },
      });

      if (signInError) {
        console.error('[Login] OAuth error:', signInError);
        setError(signInError.message);
        setIsLoading(false);
      }
      // If successful, browser will redirect to Microsoft
    } catch (err) {
      console.error('[Login] Unexpected error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo */}
        <img 
          src="/bunting-logo.png" 
          alt="Bunting Magnetics" 
          className="h-20 w-auto mx-auto"
        />

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Employee Self-Evaluation
          </h1>
          <p className="text-muted-foreground">
            Sign in with your Microsoft account to continue
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Sign in button */}
        <button
          type="button"
          onClick={handleMicrosoftLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground" />
              Redirecting to Microsoft...
            </>
          ) : (
            <>
              {/* Microsoft logo */}
              <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Sign in with Microsoft
            </>
          )}
        </button>

        {/* Footer */}
        <p className="text-xs text-muted-foreground pt-8">
          Use your Bunting Magnetics corporate account to sign in.
        </p>
      </div>
    </div>
  );
}
