import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }

    // If not loading and not authenticated, redirect to gate for SSO
    if (!isLoading && !isAuthenticated) {
      signIn();
    }
  }, [isLoading, isAuthenticated, navigate, signIn]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src="/bunting-logo.png" 
            alt="Bunting" 
            className="h-12 w-auto"
          />
        </div>

        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting to sign in...</p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          You will be redirected to sign in with your organization account.
        </p>
      </div>
    </div>
  );
}
