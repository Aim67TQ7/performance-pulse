import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BuntingGPTBrand } from '@/components/BuntingGPTBrand';
import { Loader2, Mail, CreditCard, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const GATE_URL = 'https://gate.buntinggpt.com';
const SELF_URL = 'https://self.buntinggpt.com';

export default function Login() {
  const navigate = useNavigate();
  const { loginWithEmail, loginWithBadge, isAuthenticated, tempToken, setPassword: setPasswordApi } = useAuthContext();
  
  // Email login state
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Badge login state
  const [badgeNumber, setBadgeNumber] = useState('');
  const [pin, setPin] = useState('');
  
  // Password setup state (for default password users)
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('email');

  // Check if we need to show password setup
  if (tempToken && !showPasswordSetup) {
    setShowPasswordSetup(true);
  }

  // Redirect if already authenticated (and no password setup needed)
  if (isAuthenticated && !tempToken) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSsoLogin = () => {
    const returnUrl = encodeURIComponent(SELF_URL);
    window.location.href = `${GATE_URL}?returnUrl=${returnUrl}`;
  };

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
                or use your credentials
              </span>
            </div>
          </div>

          {/* Tabbed Login Forms */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/5">
              <TabsTrigger 
                value="email" 
                className="data-[state=active]:bg-[#6B9BD2] data-[state=active]:text-white text-white/60"
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </TabsTrigger>
              <TabsTrigger 
                value="badge"
                className="data-[state=active]:bg-[#6B9BD2] data-[state=active]:text-white text-white/60"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Badge
              </TabsTrigger>
            </TabsList>

            {/* Email Login Form */}
            <TabsContent value="email" className="mt-4">
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
                      placeholder="you@bfrp.com"
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

                {activeTab === 'email' && error && (
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
                    'Sign in with Email'
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Badge Login Form */}
            <TabsContent value="badge" className="mt-4">
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

                {activeTab === 'badge' && error && (
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
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-sm">
          Contact your HR administrator if you need help accessing your account.
        </p>
      </div>
    </div>
  );
}
