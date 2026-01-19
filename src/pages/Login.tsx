import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    // If not loading and not authenticated, auto-redirect after delay
    if (!isLoading && !isAuthenticated && !redirecting) {
      const timer = setTimeout(() => {
        setRedirecting(true);
        signIn();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, navigate, signIn, redirecting]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img 
              src="/bunting-logo.png" 
              alt="Bunting" 
              className="h-12 w-auto"
            />
          </div>
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
