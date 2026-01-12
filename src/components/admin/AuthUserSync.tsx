import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface OrphanUser {
  id: string;
  email: string;
  created_at: string;
  suggested_badge: string | null;
  full_name: string | null;
}

interface UserToSync {
  auth_id: string;
  email: string;
  name_first: string;
  name_last: string;
  badge_number: string;
  selected: boolean;
}

interface AuthUserSyncProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: () => void;
}

export const AuthUserSync = ({ open, onOpenChange, onSyncComplete }: AuthUserSyncProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [users, setUsers] = useState<UserToSync[]>([]);
  const [stats, setStats] = useState({ total: 0, linked: 0 });

  const fetchOrphanUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        'https://qzwxisdfwswsrbzvpzlo.supabase.co/functions/v1/sync-auth-users',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch auth users');
      }

      const data = await response.json();
      setStats({ total: data.totalAuthUsers, linked: data.totalLinked });

      // Map orphan users to sync format
      const mapped: UserToSync[] = data.orphanUsers.map((user: OrphanUser) => {
        // Try to parse name from full_name or email
        let firstName = '';
        let lastName = '';
        
        if (user.full_name) {
          const parts = user.full_name.trim().split(' ');
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }

        return {
          auth_id: user.id,
          email: user.email,
          name_first: firstName,
          name_last: lastName,
          badge_number: user.suggested_badge || '',
          selected: false,
        };
      });

      setUsers(mapped);
    } catch (error: any) {
      console.error('Error fetching orphan users:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch auth users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchOrphanUsers();
    }
  }, [open]);

  const handleSelectAll = (checked: boolean) => {
    setUsers(prev => prev.map(u => ({ ...u, selected: checked })));
  };

  const handleSelectUser = (authId: string, checked: boolean) => {
    setUsers(prev => prev.map(u => u.auth_id === authId ? { ...u, selected: checked } : u));
  };

  const handleUpdateUser = (authId: string, field: 'name_first' | 'name_last' | 'badge_number', value: string) => {
    setUsers(prev => prev.map(u => u.auth_id === authId ? { ...u, [field]: value } : u));
  };

  const selectedUsers = users.filter(u => u.selected);
  const validSelected = selectedUsers.filter(u => u.name_first.trim() && u.name_last.trim());

  const handleSync = async () => {
    if (validSelected.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter first and last names for all selected users.',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch(
        'https://qzwxisdfwswsrbzvpzlo.supabase.co/functions/v1/sync-auth-users',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            users: validSelected.map(u => ({
              auth_id: u.auth_id,
              email: u.email,
              name_first: u.name_first,
              name_last: u.name_last,
              badge_number: u.badge_number,
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Sync request failed');
      }

      const result = await response.json();

      if (result.errors?.length > 0) {
        console.warn('Sync errors:', result.errors);
      }

      toast({
        title: 'Sync Complete',
        description: `Created ${result.created} employee records.${result.errors?.length > 0 ? ` ${result.errors.length} errors.` : ''}`,
      });

      onSyncComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync users',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Sync Auth Users to Employees
          </DialogTitle>
          <DialogDescription>
            Found {users.length} auth users without employee records. 
            {stats.total > 0 && (
              <span className="ml-1">
                ({stats.linked} of {stats.total} auth users are already linked)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading auth users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <p className="text-lg font-medium">All synced!</p>
              <p className="text-muted-foreground">Every auth user has a corresponding employee record.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={users.length > 0 && users.every(u => u.selected)}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>First Name *</TableHead>
                    <TableHead>Last Name *</TableHead>
                    <TableHead>Badge #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.auth_id} className={user.selected ? 'bg-muted/30' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={user.selected}
                          onCheckedChange={(checked) => handleSelectUser(user.auth_id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell>
                        <Input
                          value={user.name_first}
                          onChange={(e) => handleUpdateUser(user.auth_id, 'name_first', e.target.value)}
                          placeholder="First"
                          className="h-8"
                          disabled={!user.selected}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={user.name_last}
                          onChange={(e) => handleUpdateUser(user.auth_id, 'name_last', e.target.value)}
                          placeholder="Last"
                          className="h-8"
                          disabled={!user.selected}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={user.badge_number}
                          onChange={(e) => handleUpdateUser(user.auth_id, 'badge_number', e.target.value)}
                          placeholder="00000"
                          className="h-8 w-24 font-mono"
                          disabled={!user.selected}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {users.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <AlertCircle className="w-4 h-4" />
            <span>
              {selectedUsers.length} selected
              {selectedUsers.length !== validSelected.length && (
                <span className="text-amber-600 ml-1">
                  ({selectedUsers.length - validSelected.length} missing names)
                </span>
              )}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSync} 
            disabled={validSelected.length === 0 || isSyncing}
            className="gap-2"
          >
            {isSyncing && <Loader2 className="w-4 h-4 animate-spin" />}
            Import {validSelected.length} Employee{validSelected.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
