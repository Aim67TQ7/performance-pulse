import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useToken } from '@/contexts/TokenContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Lock, Settings, Calendar, ArrowLeft, Save, Mail, Users, CheckCircle2, Clock, FileEdit, Award, Eye, ShieldCheck, UserCog, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { VersionBadge } from '@/components/version/VersionBadge';
import { HierarchyTree, HierarchyMember, buildHierarchyTree, countHierarchyStats } from '@/components/evaluation/HierarchyTree';
import { CompetencyManager } from '@/components/admin/CompetencyManager';
import { SurveyPreview } from '@/components/admin/SurveyPreview';
import { EmployeeManager } from '@/components/admin/EmployeeManager';

const HR_PASSCODE = '4155';

interface AssessmentDates {
  open_date: string;
  close_date: string;
  period_start: string;
  period_end: string;
}

const HRAdmin = () => {
  const { employeeId } = useToken();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [requireAuth, setRequireAuth] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [surveyPreviewOpen, setSurveyPreviewOpen] = useState(false);
  const [dates, setDates] = useState<AssessmentDates>({
    open_date: '2026-01-01',
    close_date: '2026-01-31',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
  });
  const [companyHierarchy, setCompanyHierarchy] = useState<HierarchyMember[]>([]);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState(false);
  
  // Hardcoded assessment year - do not change without HR approval
  const ASSESSMENT_YEAR = 2025;

  useEffect(() => {
    fetchSettings();
    checkAuthMode();
  }, []);

  // Check if user has auth-based access when requireAuth is enabled
  useEffect(() => {
    if (!isLoading && requireAuth && employeeId) {
      checkAuthAccess();
    } else if (!isLoading) {
      setIsCheckingAuth(false);
    }
  }, [isLoading, requireAuth, employeeId]);

  // Load company hierarchy after authentication
  useEffect(() => {
    if (isAuthenticated) {
      loadCompanyHierarchy();
    }
  }, [isAuthenticated]);

  const checkAuthMode = async () => {
    try {
      const { data, error } = await supabase
        .from('pep_settings')
        .select('setting_value')
        .eq('setting_key', 'hr_admin_auth_mode')
        .single();

      if (!error && data?.setting_value) {
        const authMode = data.setting_value as { require_auth: boolean };
        setRequireAuth(authMode.require_auth || false);
      }
    } catch (error) {
      console.error('Error checking auth mode:', error);
    }
  };

  const checkAuthAccess = async () => {
    if (!employeeId) {
      setIsCheckingAuth(false);
      return;
    }

    try {
      // Check if user is in hr_admin_users table via their employee record
      const { data: adminUser, error: adminError } = await supabase
        .from('hr_admin_users')
        .select('id')
        .eq('employee_id', employeeId)
        .single();

      if (!adminError && adminUser) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth access:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('pep_settings')
        .select('setting_value')
        .eq('setting_key', 'assessment_dates')
        .single();

      if (error) throw error;
      if (data?.setting_value) {
        const settings = data.setting_value as unknown as AssessmentDates;
        setDates(settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = async () => {
    const newValue = !requireAuth;
    try {
      const { error } = await supabase
        .from('pep_settings')
        .update({ 
          setting_value: JSON.parse(JSON.stringify({ require_auth: newValue })),
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'hr_admin_auth_mode');

      if (error) throw error;
      
      setRequireAuth(newValue);
      toast({
        title: 'Auth mode updated',
        description: newValue 
          ? 'HR Admin now requires user authentication (hr_admin_users table).' 
          : 'HR Admin now uses passcode authentication.',
      });
    } catch (error) {
      console.error('Error updating auth mode:', error);
      toast({
        title: 'Error',
        description: 'Failed to update auth mode.',
        variant: 'destructive',
      });
    }
  };

  const loadCompanyHierarchy = async () => {
    setIsLoadingHierarchy(true);
    try {
      // Find the top-level employee (reports_to is null or self-referential for root)
      const { data: allEmployees, error } = await supabase
        .from('employees')
        .select('id, name_first, name_last, job_title, department, user_email, reports_to')
        .eq('is_active', true)
        .eq('benefit_class', 'salary');

      if (error) throw error;

      if (!allEmployees || allEmployees.length === 0) {
        setCompanyHierarchy([]);
        return;
      }

      // Find root employee(s) - those who don't report to anyone or report to themselves
      const rootEmployees = allEmployees.filter(emp => 
        !emp.reports_to || emp.reports_to === emp.id
      );

      if (rootEmployees.length === 0) {
        setCompanyHierarchy([]);
        return;
      }

      // Get all employee IDs for fetching evaluations
      const allIds = allEmployees.map(e => e.id);

      // Get evaluations for all employees using hardcoded year
      const { data: evaluations } = await supabase
        .from('pep_evaluations')
        .select('employee_id, status, submitted_at, pdf_url')
        .in('employee_id', allIds)
        .eq('period_year', ASSESSMENT_YEAR);

      const evalMap = new Map(
        evaluations?.map(e => [e.employee_id, e]) || []
      );

      // Build flat list with evaluation data
      const flatList = allEmployees.map(emp => {
        const eval_ = evalMap.get(emp.id);
        return {
          id: emp.id,
          name: `${emp.name_first} ${emp.name_last}`,
          job_title: emp.job_title,
          department: emp.department,
          evaluation_status: eval_?.status || 'not_started',
          submitted_at: eval_?.submitted_at || null,
          pdf_url: eval_?.pdf_url || null,
          email: emp.user_email || null,
          reports_to: emp.reports_to === emp.id ? null : emp.reports_to,
        };
      });

      // Build tree starting from null (root level)
      const tree = buildHierarchyTree(flatList, null);
      setCompanyHierarchy(tree);
    } catch (error) {
      console.error('Error loading company hierarchy:', error);
    } finally {
      setIsLoadingHierarchy(false);
    }
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput === HR_PASSCODE) {
      setIsAuthenticated(true);
      setPasscodeError('');
    } else {
      setPasscodeError('Invalid passcode. Please try again.');
      setPasscodeInput('');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('pep_settings')
        .update({ 
          setting_value: JSON.parse(JSON.stringify(dates)),
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'assessment_dates');

      if (error) throw error;
      
      toast({
        title: 'Settings saved',
        description: 'Assessment dates have been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendOpenNotification = () => {
    const subject = encodeURIComponent('Performance Self-Evaluation Now Open');
    const openDate = new Date(dates.open_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const closeDate = new Date(dates.close_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const periodStart = new Date(dates.period_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const periodEnd = new Date(dates.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const body = encodeURIComponent(
`Hello Team,

The Performance Self-Evaluation is now open and ready for your input.

IMPORTANT DATES:
• Assessment Period: ${periodStart} - ${periodEnd}
• Self-Assessment Open: ${openDate}
• Self-Assessment Due: ${closeDate}

HOW TO ACCESS:
1. Visit https://buntingGPT.com
2. Log in using your Bunting Microsoft network credentials
3. On sidebar, Featured section, click the Performance Self-Review link
4. Complete your self-evaluation before the due date

If you have any questions, please contact HR.

Thank you!`
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const hierarchyStats = useMemo(() => countHierarchyStats(companyHierarchy), [companyHierarchy]);

  if (isLoading || isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Auth Gate - show passcode if not using auth mode, or if auth check didn't pass
  if (!isAuthenticated) {
    // If requireAuth is true and user is identified but not authorized
    if (requireAuth && employeeId) {
      return (
        <>
          <Helmet>
            <title>HR Admin - Self Evaluation</title>
          </Helmet>
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-destructive" />
                </div>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                  You are not authorized to access HR Admin. Please contact HR if you believe this is an error.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" asChild className="w-full">
                  <Link to="/">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      );
    }

    // Show passcode gate (default behavior or when not logged in with requireAuth)
    return (
      <>
        <Helmet>
          <title>HR Admin - Self Evaluation</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>HR Admin Access</CardTitle>
              <CardDescription>Enter the HR passcode to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasscodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="passcode">Passcode</Label>
                  <Input
                    id="passcode"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder="Enter passcode"
                    className="text-center text-lg tracking-widest"
                    autoFocus
                  />
                  {passcodeError && (
                    <p className="text-sm text-destructive">{passcodeError}</p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Access Admin Panel
                </Button>
                <Button variant="ghost" asChild className="w-full">
                  <Link to="/">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Link>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Admin Panel
  return (
    <>
      <Helmet>
        <title>HR Admin - Self Evaluation</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">HR Admin</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Assessment Configuration</span>
                  <span>•</span>
                  <VersionBadge />
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Link>
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="assessment" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="assessment" className="gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Assessment</span> Settings
              </TabsTrigger>
              <TabsTrigger value="survey" className="gap-2">
                <FileText className="w-4 h-4" />
                Survey Content
              </TabsTrigger>
              <TabsTrigger value="employees" className="gap-2">
                <UserCog className="w-4 h-4" />
                <span className="hidden sm:inline">Employee</span> Management
              </TabsTrigger>
            </TabsList>

            {/* Assessment Settings Tab */}
            <TabsContent value="assessment" className="space-y-6">
              {/* Assessment Dates Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5" />
                    Assessment Dates
                  </CardTitle>
                  <CardDescription>
                    Configure the assessment period and self-assessment availability dates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Assessment Period */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      Assessment Period (Performance Year)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="period_start">Period Start</Label>
                        <Input
                          id="period_start"
                          type="date"
                          value={dates.period_start}
                          onChange={(e) => setDates({ ...dates, period_start: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="period_end">Period End</Label>
                        <Input
                          id="period_end"
                          type="date"
                          value={dates.period_end}
                          onChange={(e) => setDates({ ...dates, period_end: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Self-Assessment Window */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      Self-Assessment Window
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="open_date">Open Date</Label>
                        <Input
                          id="open_date"
                          type="date"
                          value={dates.open_date}
                          onChange={(e) => setDates({ ...dates, open_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="close_date">Close Date (Due)</Label>
                        <Input
                          id="close_date"
                          type="date"
                          value={dates.close_date}
                          onChange={(e) => setDates({ ...dates, close_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={handleSendOpenNotification} className="gap-2">
                      <Mail className="w-4 h-4" />
                      Send Opening Notification
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Company Hierarchy Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5" />
                    Company Evaluation Status
                  </CardTitle>
                  <CardDescription>
                    View evaluation status for all employees in the organization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingHierarchy ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : companyHierarchy.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No employees found
                    </div>
                  ) : (
                    <>
                      {/* Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-lg font-bold">{hierarchyStats.total}</p>
                            <p className="text-xs text-muted-foreground">Total</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="text-lg font-bold">{hierarchyStats.submitted}</p>
                            <p className="text-xs text-muted-foreground">Submitted</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileEdit className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-lg font-bold">{hierarchyStats.inProgress}</p>
                            <p className="text-xs text-muted-foreground">In Progress</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-warning" />
                          <div>
                            <p className="text-lg font-bold">{hierarchyStats.notStarted}</p>
                            <p className="text-xs text-muted-foreground">Not Started</p>
                          </div>
                        </div>
                      </div>

                      {/* Hierarchy Tree */}
                      <HierarchyTree data={companyHierarchy} defaultExpanded={false} />
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Admin Settings Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="w-5 h-5" />
                    Admin Access Settings
                  </CardTitle>
                  <CardDescription>
                    Configure how HR Admin access is controlled
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Require User Authentication</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, only users in the hr_admin_users table can access this panel.
                        When disabled, anyone with the passcode can access.
                      </p>
                    </div>
                    <Switch checked={requireAuth} onCheckedChange={toggleAuthMode} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Survey Content Tab */}
            <TabsContent value="survey" className="space-y-6">
              <CompetencyManager />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="w-5 h-5" />
                    Survey Preview
                  </CardTitle>
                  <CardDescription>
                    Preview the current survey structure as employees will see it
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => setSurveyPreviewOpen(true)} className="gap-2">
                    <Eye className="w-4 h-4" />
                    Open Survey Preview
                  </Button>
                </CardContent>
              </Card>
              <SurveyPreview open={surveyPreviewOpen} onOpenChange={setSurveyPreviewOpen} />
            </TabsContent>

            {/* Employee Management Tab */}
            <TabsContent value="employees" className="space-y-6">
              <EmployeeManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default HRAdmin;
