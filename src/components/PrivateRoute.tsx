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

  // Debug logging for auth state
  console.log('[PrivateRoute] Current state:', {
    isEmbedded,
    authReceived,
    parentAuthLoading,
    parentAuthError,
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    authLoading,
    sessionChecked,
    route: location.pathname,
    timestamp: new Date().toISOString()
  });

  // ==========================================================================
  // EMBEDDED MODE: Wait for parent auth instead of redirecting to /auth
  // ==========================================================================
  if (isEmbedded) {
    console.log('[PrivateRoute] Embedded mode decision:', {
      parentAuthLoading,
      authReceived,
      parentAuthError,
      hasUser: !!user
    });

    // Still waiting for parent to send auth
    if (parentAuthLoading && !authReceived && !parentAuthError) {
      console.log('[PrivateRoute] Showing loading - waiting for parent auth');
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
      console.log('[PrivateRoute] Showing error - parent auth failed:', parentAuthError);
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
      console.log('[PrivateRoute] Rendering children - auth successful');
      return <>{children}</>;
    }

    // Fallback loading state
    console.log('[PrivateRoute] Showing fallback loading state');
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
  // STANDALONE MODE: App is embedded-only, show access restricted message
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

  // User not authenticated in standalone mode - show access restricted message
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4 text-center">
        <img 
          src="/bunting-logo.png" 
          alt="Bunting Magnetics" 
          className="h-16 w-auto mb-4"
        />
        <div className="text-xl font-semibold text-foreground">Access Restricted</div>
        <p className="text-muted-foreground text-sm max-w-md">
          This application can only be accessed through the main BuntingGPT portal.
        </p>
        <a 
          href="https://buntinggpt.com" 
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Go to buntinggpt.com
        </a>
      </div>
    );
  }

  // Render the protected content
  return <>{children}</>;
}
