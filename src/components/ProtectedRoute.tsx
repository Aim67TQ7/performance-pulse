import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, signIn } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  // Auto-redirect after showing message
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !redirecting) {
      const timer = setTimeout(() => {
        setRedirecting(true);
        signIn();
      }, 3000); // 3 second delay to show message
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, redirecting, signIn]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show notice before redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription className="text-base mt-2">
              You must be logged into BuntingGPT.com to access this site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {redirecting 
                ? "Redirecting you to sign in..." 
                : "You will be redirected to sign in automatically..."}
            </p>
            <div className="flex justify-center">
              {redirecting ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              ) : (
                <Button onClick={() => { setRedirecting(true); signIn(); }}>
                  Sign In Now
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
