import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { BuntingGPTBrand } from './BuntingGPTBrand';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirect to login when not authenticated and not loading
    if (!isLoading && !isAuthenticated) {
      // Preserve the intended destination in state
      navigate('/login', { 
        replace: true, 
        state: { from: location.pathname } 
      });
    }
  }, [isLoading, isAuthenticated, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#6B9BD2]" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show branded loading state while redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <BuntingGPTBrand size="lg" />
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[#6B9BD2]" />
            <p className="text-white/70">Redirecting to sign in...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
