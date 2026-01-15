import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SetPassword() {
  const navigate = useNavigate();
  const { setPassword, employee, isAuthenticated, tempToken } = useAuth();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isFirstTime = !!tempToken || !isAuthenticated;
  const showCurrentPassword = isAuthenticated && !tempToken;

  // Redirect if no token at all
  useEffect(() => {
    if (!isAuthenticated && !tempToken) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, tempToken, navigate]);

  const passwordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-destructive' };
    if (score <= 4) return { score, label: 'Fair', color: 'bg-warning' };
    return { score, label: 'Strong', color: 'bg-success' };
  };

  const strength = passwordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const result = await setPassword(newPassword, showCurrentPassword ? currentPassword : undefined);
      
      if (result.success) {
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

        <Card className="shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-display">
              {isFirstTime ? 'Create Your Password' : 'Change Password'}
            </CardTitle>
            <CardDescription>
              {isFirstTime 
                ? `Welcome${employee?.name_first ? `, ${employee.name_first}` : ''}! Please create a secure password for your account.`
                : 'Enter your current password and choose a new one.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {showCurrentPassword && (
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="current-password"
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="current-password"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>
                {newPassword && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i <= strength.score ? strength.color : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      strength.label === 'Weak' ? 'text-destructive' : 
                      strength.label === 'Fair' ? 'text-warning' : 'text-success'
                    }`}>
                      Password strength: {strength.label}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </div>
                {confirmPassword && newPassword === confirmPassword && (
                  <div className="flex items-center gap-1 text-success text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Passwords match
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting password...
                  </>
                ) : (
                  isFirstTime ? 'Create Password' : 'Update Password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>Password requirements:</p>
          <ul className="list-none space-y-0.5">
            <li className={newPassword.length >= 8 ? 'text-success' : ''}>
              • At least 8 characters
            </li>
            <li className={/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? 'text-success' : ''}>
              • Mix of uppercase and lowercase
            </li>
            <li className={/[0-9]/.test(newPassword) ? 'text-success' : ''}>
              • Include numbers
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
