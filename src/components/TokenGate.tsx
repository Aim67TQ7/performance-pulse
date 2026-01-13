/**
 * TokenGate Component
 * 
 * Wraps protected content and shows appropriate UI based on token verification:
 * - Loading spinner while verifying
 * - Error screen if token invalid
 * - Children if token valid
 */

import { ReactNode } from "react";
import { useToken } from "@/contexts/TokenContext";
import { AlertTriangle, Loader2 } from "lucide-react";

interface TokenGateProps {
  children: ReactNode;
}

export function TokenGate({ children }: TokenGateProps) {
  const { isLoading, isValid, error } = useToken();

  // Show loading state while verifying token
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background">
        <img src="/bunting-logo.png" alt="Bunting Magnetics" className="h-16 w-auto" />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  // Show error screen if token is invalid
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
              href="https://buntinggpt.com" 
              className="text-primary hover:underline font-medium"
            >
              buntinggpt.com
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

  // Token is valid, render children
  return <>{children}</>;
}
