import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, CheckCircle2, Clock, FileEdit, ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VersionBadge } from '@/components/version/VersionBadge';
import { HierarchyTree, HierarchyMember, buildHierarchyTree, collectIncompleteEmails, countHierarchyStats } from '@/components/evaluation/HierarchyTree';

interface AssessmentDates {
  open_date: string;
  close_date: string;
  period_start: string;
  period_end: string;
}

const TeamStatus = () => {
  const [hierarchy, setHierarchy] = useState<HierarchyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentYear] = useState(new Date().getFullYear());
  const [assessmentDates, setAssessmentDates] = useState<AssessmentDates | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // Fetch assessment dates from settings
      try {
        const { data: settingsData } = await supabase
          .from('pep_settings')
          .select('setting_value')
          .eq('setting_key', 'assessment_dates')
          .single();
        
        if (settingsData?.setting_value) {
          setAssessmentDates(settingsData.setting_value as unknown as AssessmentDates);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }

      // Load hierarchical subordinates
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get current user's employee record
        const { data: currentEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!currentEmployee) {
          setIsLoading(false);
          return;
        }

        // Fetch all subordinates recursively using RPC or manual fetching
        // We'll fetch all employees and build the tree client-side for simplicity
        const { data: allEmployees, error } = await supabase
          .from('employees')
          .select('id, name_first, name_last, job_title, department, user_email, reports_to')
          .eq('is_active', true)
          .eq('benefit_class', 'salary');

        if (error) throw error;

        if (!allEmployees || allEmployees.length === 0) {
          setHierarchy([]);
          setIsLoading(false);
          return;
        }

        // Build a set of all subordinate IDs (recursive)
        const subordinateIds = new Set<string>();
        const findSubordinates = (managerId: string) => {
          allEmployees.forEach(emp => {
            if (emp.reports_to === managerId && !subordinateIds.has(emp.id)) {
              subordinateIds.add(emp.id);
              findSubordinates(emp.id);
            }
          });
        };
        findSubordinates(currentEmployee.id);

        if (subordinateIds.size === 0) {
          setHierarchy([]);
          setIsLoading(false);
          return;
        }

        // Get evaluations for all subordinates
        const { data: evaluations } = await supabase
          .from('pep_evaluations')
          .select('employee_id, status, submitted_at, pdf_url')
          .in('employee_id', Array.from(subordinateIds))
          .eq('period_year', currentYear);

        const evalMap = new Map(
          evaluations?.map(e => [e.employee_id, e]) || []
        );

        // Build flat list with evaluation data
        const flatList = allEmployees
          .filter(emp => subordinateIds.has(emp.id))
          .map(emp => {
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
              reports_to: emp.reports_to,
            };
          });

        // Build tree starting from current employee's direct reports
        const tree = buildHierarchyTree(flatList, currentEmployee.id);
        setHierarchy(tree);
      } catch (error) {
        console.error('Error loading subordinates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentYear]);

  const stats = useMemo(() => countHierarchyStats(hierarchy), [hierarchy]);

  // Calculate days until due date from settings
  const dueDate = useMemo(() => {
    if (!assessmentDates?.close_date) return null;
    return new Date(assessmentDates.close_date + 'T23:59:59');
  }, [assessmentDates]);

  const daysUntilDue = useMemo(() => {
    if (!dueDate) return null;
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [dueDate]);

  // Check if we're within the assessment period (from open_date to close_date)
  const isWithinAssessmentPeriod = useMemo(() => {
    if (!assessmentDates?.open_date || !assessmentDates?.close_date) return false;
    const now = new Date();
    const openDate = new Date(assessmentDates.open_date);
    const closeDate = new Date(assessmentDates.close_date + 'T23:59:59');
    return now >= openDate && now <= closeDate;
  }, [assessmentDates]);

  // Determine if we're in the urgent period (7 days or less until due)
  const isUrgent = daysUntilDue !== null && daysUntilDue <= 7 && daysUntilDue > 0;

  // Get incomplete emails from hierarchy
  const incompleteEmails = useMemo(() => collectIncompleteEmails(hierarchy), [hierarchy]);

  // Show POKE button throughout entire assessment period when there are incomplete members
  const showPokeButton = isWithinAssessmentPeriod && incompleteEmails.length > 0;

  const handlePokeTeam = () => {
    const emails = incompleteEmails.join(',');

    if (!emails || !dueDate) {
      return;
    }

    // Use different email templates based on urgency
    let subject: string;
    let body: string;
    const formattedDueDate = dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    if (isUrgent) {
      // Urgent email (7 days or less)
      subject = encodeURIComponent(`URGENT: Self-Evaluation Due in ${daysUntilDue} Day${daysUntilDue !== 1 ? 's' : ''} - Immediate Action Required`);
      body = encodeURIComponent(
        `Hello Team,\n\n` +
        `Your immediate attention is required. The self-evaluation deadline is ${formattedDueDate}, which is only ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} away.\n\n` +
        `This is a mandatory evaluation and must be completed before the deadline.\n\n` +
        `Please log in to self.buntinggpt.com using your Microsoft network credentials and complete your self-evaluation today.\n\n` +
        `Thank you for your prompt attention to this matter.`
      );
    } else {
      // Standard reminder email (more than 7 days)
      subject = encodeURIComponent(`Reminder: Self-Evaluation Due ${formattedDueDate}`);
      body = encodeURIComponent(
        `Hello Team,\n\n` +
        `This is a friendly reminder that your self-evaluation is due on ${formattedDueDate}.\n\n` +
        `Please log in to self.buntinggpt.com using your Microsoft network credentials and complete your evaluation at your earliest convenience.\n\n` +
        `Thank you!`
      );
    }

    window.location.href = `mailto:${emails}?subject=${subject}&body=${body}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading team status...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Team Evaluation Status | Bunting PEP</title>
        <meta name="description" content="View your team's self-evaluation submission status." />
      </Helmet>
      
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <img 
                src="/bunting-logo.png" 
                alt="Bunting Magnetics" 
                className="h-14 w-auto"
              />
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
                  Team Evaluation Status
                </h1>
                <div className="flex items-center gap-2">
                  <p className="text-muted-foreground text-sm">
                    {currentYear} Self-Review Progress
                  </p>
                  <span className="text-muted-foreground">•</span>
                  <VersionBadge />
                  {daysUntilDue !== null && daysUntilDue > 0 && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className={`text-sm font-medium ${daysUntilDue <= 7 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''} until due
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showPokeButton && (
                <Button 
                  variant={isUrgent ? "destructive" : "default"}
                  onClick={handlePokeTeam}
                  className="gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {isUrgent ? 'Urgent Reminder' : 'Send Reminder'} ({incompleteEmails.length})
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to="/" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{stats.submitted}</p>
                    <p className="text-sm text-muted-foreground">Submitted</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FileEdit className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{stats.inProgress}</p>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-warning" />
                  <div>
                    <p className="text-2xl font-bold">{stats.notStarted}</p>
                    <p className="text-sm text-muted-foreground">Not Started</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Hierarchy */}
          {hierarchy.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Direct Reports</h3>
                <p className="text-muted-foreground">
                  You don't have any direct reports in the system.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Hierarchy ({stats.total})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HierarchyTree data={hierarchy} defaultExpanded={false} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default TeamStatus;
