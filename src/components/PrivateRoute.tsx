/**
 * PrivateRoute Component
 * 
 * Protects routes by redirecting unauthenticated users to login.buntinggpt.com.
 */

import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface PrivateRouteProps {
  children: ReactNode;
}

const LOGIN_PORTAL = "https://login.buntinggpt.com";

export function PrivateRoute({ children }: PrivateRouteProps) {
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
