/**
 * TokenGate Component
 *
 * Wraps protected content and shows appropriate UI based on session verification:
 * - Loading spinner while verifying
 * - Error screen if session invalid
 * - Children if session valid
 */

import { ReactNode, useMemo } from "react";
import { useToken } from "@/contexts/TokenContext";
import { AlertTriangle } from "lucide-react";

interface TokenGateProps {
  children: ReactNode;
}

const AUTH_HUB_URL = 'https://login.buntinggpt.com';

export function TokenGate({ children }: TokenGateProps) {
  const { isLoading, isValid, error } = useToken();

  // Build login URL with return_url parameter
  const loginUrl = useMemo(() => {
    if (typeof window === 'undefined') return AUTH_HUB_URL;
    const returnUrl = encodeURIComponent(window.location.href);
    return `${AUTH_HUB_URL}?return_url=${returnUrl}`;
  }, []);

  // Show loading state while verifying session
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background">
        <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto" />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  // Show error screen if session is invalid
  if (!isValid) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 bg-background p-4">
        <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto" />
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            Please access this app from{" "}
            <a
              href={loginUrl}
              className="text-primary hover:underline font-medium"
            >
              login.buntinggpt.com
            </a>
          </p>
          {error && (
            <p className="text-sm text-muted-foreground/70 mt-2">
              Error: {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Session is valid, render children
  return <>{children}</>;
}
