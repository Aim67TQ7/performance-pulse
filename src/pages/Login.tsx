import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BuntingGPTBrand } from '@/components/BuntingGPTBrand';
import { Loader2, CreditCard, ShieldCheck } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

const GATE_URL = 'https://gate.buntinggpt.com';
const SELF_URL = 'https://self.buntinggpt.com';

export default function Login() {
  const navigate = useNavigate();
  const { loginWithBadge, isAuthenticated } = useAuthContext();
  
  const [badgeNumber, setBadgeNumber] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSsoLogin = () => {
    const returnUrl = encodeURIComponent(SELF_URL);
    window.location.href = `${GATE_URL}?returnUrl=${returnUrl}`;
  };

  const handleBadgeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await loginWithBadge(badgeNumber, pin);
      
      if (result.success) {
        navigate('/', { replace: true });
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center gap-4">
          <BuntingGPTBrand size="lg" href={undefined} />
          <h1 className="text-2xl font-semibold text-white">
            Self-Evaluation Portal
          </h1>
          <p className="text-white/60 text-center">
            Sign in to access your performance evaluation
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
          {/* SSO Button */}
          <Button 
            onClick={handleSsoLogin}
            className="w-full h-12 bg-[#0078D4] hover:bg-[#106EBE] text-white font-medium"
            disabled={isLoading}
          >
            <ShieldCheck className="w-5 h-5 mr-2" />
            Sign in with Microsoft
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#1A1A2E] text-white/50">
                or sign in with your badge
              </span>
            </div>
          </div>

          {/* Badge Login Form */}
          <form onSubmit={handleBadgeLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="badge" className="text-white/80">
                Badge Number
              </Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="badge"
                  type="text"
                  placeholder="Enter your badge number"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-[#6B9BD2]"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin" className="text-white/80">
                PIN
              </Label>
              <Input
                id="pin"
                type="password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-[#6B9BD2]"
                disabled={isLoading}
                maxLength={20}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[#6B9BD2] hover:bg-[#5A8BC2] text-white font-medium"
              disabled={isLoading || !badgeNumber || !pin}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in with Badge'
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-sm">
          Contact your HR administrator if you need help accessing your account.
        </p>
      </div>
    </div>
  );
}
