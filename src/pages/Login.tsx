import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

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
          <p className="text-muted-foreground">
            Please{' '}
            <a 
              href="https://gate.buntinggpt.com" 
              className="text-primary underline hover:text-primary/80"
            >
              log in here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
