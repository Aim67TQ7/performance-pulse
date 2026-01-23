import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { purgeAllAuthCookies } from '@/lib/supabase-storage';
import { Loader2 } from 'lucide-react';
import { BuntingGPTBrand } from './BuntingGPTBrand';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const GATE_URL = 'https://gate.buntinggpt.com';

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    // Redirect to gate with return URL when not authenticated and not loading
    if (!isLoading && !isAuthenticated) {
      // Purge stale cookies before redirecting to gate
      purgeAllAuthCookies();
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `${GATE_URL}?returnUrl=${returnUrl}`;
    }
  }, [isLoading, isAuthenticated]);

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
