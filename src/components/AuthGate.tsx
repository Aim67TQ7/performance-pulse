import { useAuth } from '@/hooks/useAuth';
import { Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate = ({ children }: AuthGateProps) => {
  const { isLoading, isAuthenticated, redirectToLogin } = useAuth();

  useEffect(() => {
    // Auto-redirect after a brief delay if not authenticated
    if (!isLoading && !isAuthenticated) {
      const timer = setTimeout(() => {
        redirectToLogin();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, redirectToLogin]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img 
            src="/bunting-logo.png" 
            alt="Bunting Magnetics" 
            className="h-16 w-auto mb-4"
          />
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 text-center max-w-md px-4">
          <img 
            src="/bunting-logo.png" 
            alt="Bunting Magnetics" 
            className="h-20 w-auto"
          />
          <div>
            <h1 className="text-2xl font-display font-semibold text-foreground mb-2">
              Authentication Required
            </h1>
            <p className="text-muted-foreground">
              You need to be logged in to access the Performance Self-Evaluation. Redirecting to login...
            </p>
          </div>
          <Button onClick={redirectToLogin} className="gap-2">
            <LogIn className="w-4 h-4" />
            Go to Login
          </Button>
          <p className="text-xs text-muted-foreground">
            You will be redirected automatically in a few seconds.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
