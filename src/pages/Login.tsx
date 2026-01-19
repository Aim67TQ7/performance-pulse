import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { BuntingGPTBrand } from '@/components/BuntingGPTBrand';

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
    <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Brand */}
        <div className="flex justify-center">
          <BuntingGPTBrand size="lg" />
        </div>

        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-white/70">
            Please{' '}
            <a 
              href="https://gate.buntinggpt.com" 
              className="text-[#6B9BD2] underline hover:text-[#6B9BD2]/80"
            >
              log in here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
