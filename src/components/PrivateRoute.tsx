/**
 * PrivateRoute Component for BuntingGPT Subdomain Apps
 * 
 * Protects routes by redirecting unauthenticated users to login.buntinggpt.com
 */

import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface PrivateRouteProps {
  children: ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { isLoading, isAuthenticated, login } = useAuth();

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

  // Redirect to central login if not authenticated
  if (!isAuthenticated) {
    login();
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
