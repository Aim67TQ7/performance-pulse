import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Key, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const SUPABASE_URL = "https://qzwxisdfwswsrbzvpzlo.supabase.co";
const AUTH_API_URL = `${SUPABASE_URL}/functions/v1/employee-auth`;

export function PasswordManagement() {
  const [defaultPassword, setDefaultPassword] = useState('1Bunting!');
  const [isSettingAll, setIsSettingAll] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState(false);

  const handleSetAllPasswords = async () => {
    if (!confirmAction) {
      setConfirmAction(true);
      return;
    }

    setIsSettingAll(true);
    setLastResult(null);

    try {
      // Get the service role key from a prompt (for security, we don't store it)
      const adminKey = prompt('Enter the Supabase Service Role Key to authorize this action:');
      
      if (!adminKey) {
        setIsSettingAll(false);
        setConfirmAction(false);
        return;
      }

      const response = await fetch(`${AUTH_API_URL}/admin/set-default-passwords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_key: adminKey,
          default_password: defaultPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set passwords');
      }

      setLastResult({
        success: true,
        message: data.message || `Default password set for ${data.employees_updated} employees`
      });

      toast({
        title: 'Passwords Updated',
        description: data.message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set passwords';
      setLastResult({ success: false, message });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSettingAll(false);
      setConfirmAction(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="w-5 h-5" />
          Password Management
        </CardTitle>
        <CardDescription>
          Set default passwords for employee accounts. Users will be prompted to change their password on first login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Password Setting */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-password">Default Password</Label>
            <Input
              id="default-password"
              type="text"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              placeholder="Welcome2Bunting!"
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              This password will be set for all employees. They must change it on first login.
            </p>
          </div>

          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This will reset the password for ALL active employees with email addresses.
              Users who have already set their own passwords will need to use this new default password.
            </AlertDescription>
          </Alert>

          {/* Result Message */}
          {lastResult && (
            <Alert variant={lastResult.success ? 'default' : 'destructive'}>
              {lastResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>{lastResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {confirmAction ? (
              <>
                <Button 
                  variant="destructive" 
                  onClick={handleSetAllPasswords}
                  disabled={isSettingAll || defaultPassword.length < 8}
                  className="gap-2"
                >
                  {isSettingAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  Confirm: Set All Passwords
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setConfirmAction(false)}
                  disabled={isSettingAll}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleSetAllPasswords}
                disabled={defaultPassword.length < 8}
                className="gap-2"
              >
                <Users className="w-4 h-4" />
                Set Default Password for All Employees
              </Button>
            )}
          </div>

          {defaultPassword.length < 8 && (
            <p className="text-sm text-destructive">
              Password must be at least 8 characters
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">How it works:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Set a default password above (default: Welcome2Bunting!)</li>
            <li>Click the button to set this password for all active employees</li>
            <li>Employees log in with their email and the default password</li>
            <li>On first login, they are required to create their own password</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
