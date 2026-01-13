/**
 * PrivateRoute Component for BuntingGPT Subdomain Apps
 * 
 * Protects routes by redirecting unauthenticated users to login.buntinggpt.com
 */

import { ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface PrivateRouteProps {
  children: ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { isLoading, isAuthenticated, login, user, isEmbedded, authReceived, error, requestAuth } = useAuth();
  const hasRedirected = useRef(false);

  // Debug logging
  console.log('[PrivateRoute] State:', {
    isLoading,
    isAuthenticated,
    isEmbedded,
    authReceived,
    hasUser: !!user,
    userId: user?.id,
    error,
    hasRedirected: hasRedirected.current,
    timestamp: new Date().toISOString()
  });

  // Embedded mode: ask parent for auth (no redirect)
  useEffect(() => {
    if (!isEmbedded) return;
    if (!isLoading && !isAuthenticated && !authReceived) {
      requestAuth();
    }
  }, [isEmbedded, isLoading, isAuthenticated, authReceived, requestAuth]);

  // Standalone mode: redirect to login after load
  useEffect(() => {
    if (isEmbedded) return;
    if (!isLoading && !isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true;
      const timer = setTimeout(() => login(), 50);
      return () => clearTimeout(timer);
    }
  }, [isEmbedded, isLoading, isAuthenticated, login]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto" />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  // Embedded mode: show failure only after parent auth attempt finishes
  if (isEmbedded && !isAuthenticated) {
    if (authReceived && error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 p-4 text-center">
          <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto mb-4" />
          <div className="text-destructive text-lg font-semibold">Authentication Failed</div>
          <p className="text-muted-foreground text-sm max-w-md">
            Unable to authenticate via the parent portal. Please refresh the parent page and try again.
          </p>
          <p className="text-xs text-muted-foreground">Error: {error}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto" />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Waiting for portal authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto" />
        <p className="text-sm text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return <>{children}</>;
}
