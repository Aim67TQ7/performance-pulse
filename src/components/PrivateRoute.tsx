/**
 * PrivateRoute Component for BuntingGPT Subdomain Apps
 * 
 * This component protects routes and handles both:
 * 1. Standalone mode: Normal Supabase auth flow
 * 2. Embedded mode: Receives auth from parent buntinggpt.com app
 */

import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useParentAuth } from "@/hooks/useParentAuth";

interface PrivateRouteProps {
  children: ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, isLoading: authLoading, sessionChecked } = useAuth();
  const { isEmbedded, authReceived, isLoading: parentAuthLoading, error: parentAuthError } = useParentAuth();
  const location = useLocation();

  // ==========================================================================
  // EMBEDDED MODE: Wait for parent auth instead of redirecting to /auth
  // ==========================================================================
  if (isEmbedded) {
    // Still waiting for parent to send auth
    if (parentAuthLoading && !authReceived && !parentAuthError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <img 
            src="/bunting-logo.png" 
            alt="Bunting Magnetics" 
            className="h-16 w-auto mb-4"
          />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Authenticating with parent app...</p>
        </div>
      );
    }

    // Parent auth failed/timed out
    if (parentAuthError && !user) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 p-4 text-center">
          <img 
            src="/bunting-logo.png" 
            alt="Bunting Magnetics" 
            className="h-16 w-auto mb-4"
          />
          <div className="text-destructive text-lg font-semibold">Authentication Failed</div>
          <p className="text-muted-foreground text-sm max-w-md">
            Unable to receive authentication from the parent application.
            Please ensure you are logged in to buntinggpt.com and try refreshing.
          </p>
          <p className="text-xs text-muted-foreground">Error: {parentAuthError}</p>
        </div>
      );
    }

    // Auth received or user exists - render children
    if (authReceived || user) {
      return <>{children}</>;
    }

    // Fallback loading state
    return (
      <div className="flex items-center justify-center h-screen">
        <img 
          src="/bunting-logo.png" 
          alt="Bunting Magnetics" 
          className="h-16 w-auto mb-4"
        />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ==========================================================================
  // STANDALONE MODE: Normal auth flow
  // ==========================================================================
  
  // Show loading while checking authentication
  if (authLoading || !sessionChecked) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <img 
          src="/bunting-logo.png" 
          alt="Bunting Magnetics" 
          className="h-16 w-auto"
        />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Redirect to auth page if not logged in
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Render the protected content
  return <>{children}</>;
}
