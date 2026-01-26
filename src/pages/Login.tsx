import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BuntingGPTBrand } from '@/components/BuntingGPTBrand';
import { Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { loginWithEmail, isAuthenticated, tempToken, setPassword: setPasswordApi } = useAuthContext();
  
  // Email login state
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Password setup state (for default password users)
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if we need to show password setup
  if (tempToken && !showPasswordSetup) {
    setShowPasswordSetup(true);
  }

  // Redirect if already authenticated (and no password setup needed)
  if (isAuthenticated && !tempToken) {
    navigate('/', { replace: true });
    return null;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await loginWithEmail(email, emailPassword);
      
      if (result.success) {
        if (result.requiresPasswordSetup || result.mustSetPassword) {
          setShowPasswordSetup(true);
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const result = await setPasswordApi(newPassword);
      
      if (result.success) {
        setShowPasswordSetup(false);
        navigate('/', { replace: true });
      } else {
        setError(result.error || 'Failed to set password');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Password Setup Screen
  if (showPasswordSetup) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center gap-4">
            <BuntingGPTBrand size="lg" href={undefined} />
            <h1 className="text-2xl font-semibold text-white">
              Set Your Password
            </h1>
            <p className="text-white/60 text-center">
              Please create a new password to secure your account
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <form onSubmit={handlePasswordSetup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-white/80">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-[#6B9BD2] pr-10"
                    disabled={isLoading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-white/40">Minimum 8 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white/80">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-[#6B9BD2]"
                  disabled={isLoading}
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
                disabled={isLoading || !newPassword || !confirmPassword}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting password...
                  </>
                ) : (
                  'Set Password & Continue'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

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
          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@buntingmagnetics.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-[#6B9BD2]"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-[#6B9BD2] pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-white/40">
                Default password: 1Bunting! (you'll be prompted to change it)
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-[#6B9BD2] hover:bg-[#5A8BC2] text-white font-medium"
              disabled={isLoading || !email || !emailPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
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
