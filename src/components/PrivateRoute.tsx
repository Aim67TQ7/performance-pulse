/**
 * PrivateRoute Component for BuntingGPT Subdomain Apps
 * 
 * This component protects routes and handles both:
 * 1. Embedded mode: Shows loading/error states while waiting for parent auth
 * 2. Standalone mode: Shows "Access Restricted" message (embedded-only app)
 */

import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface PrivateRouteProps {
  children: ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, isLoading, isEmbedded, authReceived, error } = useAuth();

  // Debug logging for auth state
  console.log('[PrivateRoute] Current state:', {
    isEmbedded,
    authReceived,
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    isLoading,
    error,
    timestamp: new Date().toISOString()
  });

  // ==========================================================================
  // LOADING STATE: Show spinner while checking authentication
  // ==========================================================================
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <img 
          src="/bunting-logo.png" 
          alt="Bunting Magnetics" 
          className="h-16 w-auto"
        />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">
          {isEmbedded ? 'Authenticating with parent app...' : 'Loading...'}
        </p>
      </div>
    );
  }

  // ==========================================================================
  // EMBEDDED MODE: Handle auth success/failure
  // ==========================================================================
  if (isEmbedded) {
    // Auth error in embedded mode
    if (error && !user) {
      console.log('[PrivateRoute] Showing error - auth failed:', error);
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
          <p className="text-xs text-muted-foreground">Error: {error}</p>
        </div>
      );
    }

    // Auth received or user exists - render children
    if (authReceived || user) {
      console.log('[PrivateRoute] Rendering children - auth successful');
      return <>{children}</>;
    }

    // Fallback: No user and no error in embedded mode
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-4 text-center">
        <img 
          src="/bunting-logo.png" 
          alt="Bunting Magnetics" 
          className="h-16 w-auto mb-4"
        />
        <p className="text-muted-foreground">
          Authentication required. Please access from parent app.
        </p>
      </div>
    );
  }

  // ==========================================================================
  // STANDALONE MODE: App is embedded-only, show access restricted message
  // ==========================================================================
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
