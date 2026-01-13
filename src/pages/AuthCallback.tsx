/**
 * OAuth Callback Handler
 * 
 * Completes the OAuth token exchange after Microsoft redirects back.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AuthCallback] Processing OAuth callback...');

        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        // Check for OAuth errors
        const error = params.get('error') || hashParams.get('error');
        const errorDescription = params.get('error_description') || hashParams.get('error_description');
        if (error) {
          console.error('[AuthCallback] OAuth error:', error, errorDescription);
          setStatus('error');
          setErrorMessage(errorDescription || error);
          return;
        }

        // Exchange code for session (PKCE flow)
        const code = params.get('code');
        if (code) {
          console.log('[AuthCallback] Exchanging code for session...');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchangeError) {
            console.error('[AuthCallback] Exchange error:', exchangeError);
            setStatus('error');
            setErrorMessage(exchangeError.message);
            return;
          }
        } else {
          // Give detectSessionInUrl a moment for implicit flows
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Verify session was created
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[AuthCallback] Session error:', sessionError);
          setStatus('error');
          setErrorMessage(sessionError.message);
          return;
        }

        if (!session) {
          console.warn('[AuthCallback] No session created');
          setStatus('error');
          setErrorMessage('Authentication completed but no session was created. Please try again.');
          return;
        }

        console.log('[AuthCallback] Success! User:', session.user.email);
        setStatus('success');

        // Small delay to ensure storage is written
        await new Promise(resolve => setTimeout(resolve, 200));

        // Redirect to stored return URL or home
        const returnUrl = sessionStorage.getItem('auth_return_url');
        sessionStorage.removeItem('auth_return_url');
        navigate(returnUrl || '/', { replace: true });
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-4 text-center">
      <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto mb-4" />
      
      {status === 'loading' && (
        <>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Completing sign in...</p>
        </>
      )}
      
      {status === 'success' && (
        <>
          <div className="text-green-600 text-lg font-semibold">Sign in successful!</div>
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <div className="text-destructive text-lg font-semibold">Authentication Failed</div>
          <p className="text-muted-foreground text-sm max-w-md">
            {errorMessage || 'Unable to complete sign in. Please try again.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Return to Login
          </button>
        </>
      )}
    </div>
  );
}
