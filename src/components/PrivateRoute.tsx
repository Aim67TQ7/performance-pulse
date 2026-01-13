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
  const { isLoading, isAuthenticated, login, user } = useAuth();
  const hasRedirected = useRef(false);

  // Debug logging
  console.log('[PrivateRoute] State:', {
    isLoading,
    isAuthenticated,
    hasUser: !!user,
    userId: user?.id,
    hasRedirected: hasRedirected.current,
    timestamp: new Date().toISOString()
  });

  // Handle redirect in useEffect to prevent flash
  useEffect(() => {
    // Only redirect if:
    // 1. Not loading (auth check complete)
    // 2. Not authenticated
    // 3. Haven't already redirected
    if (!isLoading && !isAuthenticated && !hasRedirected.current) {
      console.log('[PrivateRoute] No session after load, redirecting to login...');
      hasRedirected.current = true;
      // Small delay to ensure we're not in a race condition with session hydration
      const timer = setTimeout(() => {
        login();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, login]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <img 
          src="/bunting-logo.png" 
          alt="Bunting Magnetics" 
          className="h-16 w-auto"
        />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  // Show redirecting state if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <img 
          src="/bunting-logo.png" 
          alt="Bunting Magnetics" 
          className="h-16 w-auto"
        />
        <p className="text-sm text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  // Render protected content
  return <>{children}</>;
}
