/**
 * PrivateRoute Component
 * 
 * Protects routes by redirecting unauthenticated users to login.buntinggpt.com.
 */

import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface PrivateRouteProps {
  children: ReactNode;
}

const LOGIN_PORTAL = "https://login.buntinggpt.com";

export function PrivateRoute({ children }: PrivateRouteProps) {
  // At the VERY TOP of the component, before anything else
  const [debugStop] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'stop';
  });

  if (debugStop) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        <h1>DEBUG MODE - Redirects Disabled</h1>
        <button onClick={async () => {
          const { data } = await supabase.auth.getSession();
          alert(`Session: ${data.session ? 'YES - ' + data.session.user.email : 'NO'}`);
        }}>Check Session</button>
        <br/><br/>
        <button onClick={() => {
          alert(`Cookies: ${document.cookie}`);
        }}>Check Cookies</button>
        <br/><br/>
        <button onClick={() => {
          const params = new URLSearchParams(window.location.search);
          alert(`returnUrl param: ${params.get('returnUrl')}`);
        }}>Check returnUrl</button>
        <br/><br/>
        <button onClick={() => {
          window.location.href = 'https://self.buntinggpt.com?debug=stop';
        }}>Go to self.buntinggpt.com (with debug)</button>
        <br/><br/>
        <button onClick={() => {
          document.cookie.split(';').forEach(c => {
            document.cookie = c.trim().split('=')[0] + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.buntinggpt.com';
          });
          localStorage.clear();
          sessionStorage.clear();
          alert('Cleared all cookies, localStorage, and sessionStorage');
        }} style={{ background: 'red', color: 'white', padding: '10px' }}>🔥 Nuclear Clear</button>
      </div>
    );
  }

  const { isLoading, isAuthenticated } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto" />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Redirect to central login portal if not authenticated
  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `${LOGIN_PORTAL}?returnUrl=${returnUrl}`;
    
    // Show redirect message while navigating
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto" />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return <>{children}</>;
}
