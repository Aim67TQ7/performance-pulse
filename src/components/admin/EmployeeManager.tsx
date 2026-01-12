import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Search, UserPlus, Users, ChevronLeft, ChevronRight, Upload, RefreshCw } from 'lucide-react';
import { EmployeeImport } from './EmployeeImport';
import { AuthUserSync } from './AuthUserSync';
import { toast } from '@/hooks/use-toast';

type JobLevel = Database['public']['Enums']['job_level'];

interface Employee {
  id: string;
  name_first: string;
  name_last: string;
  job_title: string | null;
  department: string | null;
  location: string | null;
  badge_number: string | null;
  user_email: string | null;
  employee_number: string | null;
  reports_to: string;
  is_active: boolean;
  hire_date: string | null;
  benefit_class: string | null;
  job_level: JobLevel | null;
}

interface EmployeeFormData {
  name_first: string;
  name_last: string;
  job_title: string;
  department: string;
  location: string;
  badge_number: string;
  user_email: string;
  employee_number: string;
  reports_to: string;
  is_active: boolean;
  hire_date: string;
  benefit_class: string;
  job_level: JobLevel;
}

const INITIAL_FORM: EmployeeFormData = {
  name_first: '',
  name_last: '',
  job_title: '',
  department: '',
  location: '',
  badge_number: '',
  user_email: '',
  employee_number: '',
  reports_to: '',
  is_active: true,
  hire_date: '',
  benefit_class: 'salary',
  job_level: 'Employee',
};

const LOCATIONS = ['Newton, KS', 'Pittsburgh, PA', 'Elk Grove Village, IL', 'Redditch, UK', 'Remote'];
const BENEFIT_CLASSES = ['salary', 'hourly', 'contractor', 'intern'];
const JOB_LEVELS: JobLevel[] = ['Employee', 'Lead', 'Supervisor', 'Manager', 'Executive', 'Admin'];
const PAGE_SIZE = 15;

export const EmployeeManager = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]); // For reports_to dropdown
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(INITIAL_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name_first, name_last, job_title, department, location, badge_number, user_email, employee_number, reports_to, is_active, hire_date, benefit_class, job_level')
        .order('name_last', { ascending: true });

      if (error) throw error;
      setAllEmployees(data || []);
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employees.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('department')
        .not('department', 'is', null);

      if (error) throw error;
      const uniqueDepts = [...new Set(data?.map(d => d.department).filter(Boolean) as string[])].sort();
      setDepartments(uniqueDepts);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const filteredEmployees = useMemo(() => {
    let result = employees;

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(e => e.is_active);
    } else if (statusFilter === 'inactive') {
      result = result.filter(e => !e.is_active);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        `${e.name_first} ${e.name_last}`.toLowerCase().includes(query) ||
        e.job_title?.toLowerCase().includes(query) ||
        e.department?.toLowerCase().includes(query) ||
        e.badge_number?.toLowerCase().includes(query) ||
        e.user_email?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [employees, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredEmployees.length / PAGE_SIZE);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormData(INITIAL_FORM);
    setDialogOpen(true);
  };

  const handleOpenEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name_first: employee.name_first,
      name_last: employee.name_last,
      job_title: employee.job_title || '',
      department: employee.department || '',
      location: employee.location || '',
      badge_number: employee.badge_number || '',
      user_email: employee.user_email || '',
      employee_number: employee.employee_number || '',
      reports_to: employee.reports_to || '',
      is_active: employee.is_active,
      hire_date: employee.hire_date || '',
      benefit_class: employee.benefit_class || 'salary',
      job_level: employee.job_level || 'Employee',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name_first.trim() || !formData.name_last.trim()) {
      toast({
        title: 'Validation Error',
        description: 'First and last name are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name_first: formData.name_first.trim(),
        name_last: formData.name_last.trim(),
        job_title: formData.job_title.trim() || null,
        department: formData.department || null,
        location: formData.location || null,
        badge_number: formData.badge_number.trim() || null,
        user_email: formData.user_email.trim() || null,
        employee_number: formData.employee_number.trim() || null,
        reports_to: formData.reports_to || null,
        is_active: formData.is_active,
        hire_date: formData.hire_date || null,
        benefit_class: formData.benefit_class || null,
        job_level: formData.job_level || 'Employee',
        updated_at: new Date().toISOString(),
      };

      if (editingEmployee) {
        // Update existing
        const { error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        toast({ title: 'Employee updated', description: `${formData.name_first} ${formData.name_last} has been updated.` });
      } else {
        // Create new - need to handle reports_to requirement
        const createPayload = {
          ...payload,
          reports_to: formData.reports_to || undefined, // Will be set after creation if needed
        };
        
        const { data, error } = await supabase
          .from('employees')
          .insert(createPayload)
          .select('id')
          .single();

        if (error) throw error;
        
        // If no reports_to was set, make them report to themselves (root node)
        if (!formData.reports_to && data) {
          await supabase
            .from('employees')
            .update({ reports_to: data.id })
            .eq('id', data.id);
        }
        
        toast({ title: 'Employee created', description: `${formData.name_first} ${formData.name_last} has been added.` });
      }

      setDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save employee.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getManagerName = (reportsTo: string) => {
    const manager = allEmployees.find(e => e.id === reportsTo);
    if (!manager) return '—';
    if (manager.id === reportsTo && employees.find(e => e.id === reportsTo)?.reports_to === reportsTo) {
      return '(Self - Root)';
    }
    return `${manager.name_first} ${manager.name_last}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                Employee Management
              </CardTitle>
              <CardDescription>
                Add, edit, and manage employee records ({filteredEmployees.length} employees)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSyncDialogOpen(true)} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Sync from Auth
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Import CSV
              </Button>
              <Button onClick={handleOpenCreate} className="gap-2">
                <UserPlus className="w-4 h-4" />
                Add Employee
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, title, department, badge..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Title</TableHead>
                  <TableHead className="hidden lg:table-cell">Department</TableHead>
                  <TableHead className="hidden sm:table-cell">Badge</TableHead>
                  <TableHead className="hidden lg:table-cell">Reports To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{employee.name_first} {employee.name_last}</p>
                          <p className="text-xs text-muted-foreground md:hidden">{employee.job_title}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{employee.job_title || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{employee.department || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-sm">{employee.badge_number || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{getManagerName(employee.reports_to)}</TableCell>
                      <TableCell>
                        <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(employee)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingEmployee ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee ? 'Update employee information below.' : 'Fill in the details to create a new employee record.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name_first">First Name *</Label>
                <Input
                  id="name_first"
                  value={formData.name_first}
                  onChange={(e) => setFormData({ ...formData, name_first: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_last">Last Name *</Label>
                <Input
                  id="name_last"
                  value={formData.name_last}
                  onChange={(e) => setFormData({ ...formData, name_last: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  placeholder="Software Engineer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_level">Job Level</Label>
                <Select value={formData.job_level} onValueChange={(v) => setFormData({ ...formData, job_level: v as JobLevel })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_LEVELS.map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select value={formData.location} onValueChange={(v) => setFormData({ ...formData, location: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* IDs and Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="badge_number">Badge Number</Label>
                <Input
                  id="badge_number"
                  value={formData.badge_number}
                  onChange={(e) => setFormData({ ...formData, badge_number: e.target.value })}
                  placeholder="12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee_number">Employee Number</Label>
                <Input
                  id="employee_number"
                  value={formData.employee_number}
                  onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                  placeholder="EMP001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_email">Email Address</Label>
              <Input
                id="user_email"
                type="email"
                value={formData.user_email}
                onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                placeholder="john.doe@company.com"
              />
            </div>

            {/* Employment Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hire_date">Hire Date</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benefit_class">Benefit Class</Label>
                <Select value={formData.benefit_class} onValueChange={(v) => setFormData({ ...formData, benefit_class: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BENEFIT_CLASSES.map(bc => (
                      <SelectItem key={bc} value={bc}>{bc.charAt(0).toUpperCase() + bc.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reports To */}
            <div className="space-y-2">
              <Label htmlFor="reports_to">Reports To</Label>
              <Select value={formData.reports_to || 'none'} onValueChange={(v) => setFormData({ ...formData, reports_to: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Manager (Root)</SelectItem>
                  {allEmployees
                    .filter(e => e.id !== editingEmployee?.id && e.is_active)
                    .map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name_first} {emp.name_last} {emp.job_title ? `(${emp.job_title})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive employees won't appear in evaluation workflows
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingEmployee ? 'Save Changes' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmployeeImport
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={fetchEmployees}
      />

      <AuthUserSync
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        onSyncComplete={fetchEmployees}
      />
    </>
  );
};
