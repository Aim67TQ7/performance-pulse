/**
 * Login Page - Redirects to Central Login Portal
 * 
 * This app uses cross-subdomain SSO. All logins happen at login.buntinggpt.com.
 */

import { useEffect } from 'react';

const LOGIN_PORTAL = "https://login.buntinggpt.com";

export default function Login() {
  useEffect(() => {
    // Redirect to central login with return URL
    const returnUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${LOGIN_PORTAL}?returnUrl=${returnUrl}`;
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <img 
          src="/bunting-logo.png" 
          alt="Bunting Magnetics" 
          className="h-20 w-auto mx-auto"
        />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Employee Self-Evaluation
          </h1>
          <p className="text-muted-foreground">
            Redirecting to login...
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    </div>
  );
}
