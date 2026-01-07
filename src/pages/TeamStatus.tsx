import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, CheckCircle2, Clock, FileEdit, ArrowLeft, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VersionBadge } from '@/components/version/VersionBadge';

interface SubordinateStatus {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  evaluation_status: 'not_started' | 'draft' | 'submitted' | 'reopened' | 'reviewed' | 'signed';
  submitted_at: string | null;
  updated_at: string | null;
  pdf_url?: string | null;
}

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', variant: 'outline' as const, icon: Clock },
  draft: { label: 'In Progress', variant: 'secondary' as const, icon: FileEdit },
  reopened: { label: 'Reopened', variant: 'default' as const, icon: FileEdit },
  submitted: { label: 'Submitted', variant: 'default' as const, icon: CheckCircle2 },
  reviewed: { label: 'Reviewed', variant: 'default' as const, icon: CheckCircle2 },
  signed: { label: 'Signed', variant: 'default' as const, icon: CheckCircle2 },
};

const TeamStatus = () => {
  const [subordinates, setSubordinates] = useState<SubordinateStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const loadSubordinates = async () => {
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

        // Get all direct reports
        const { data: directReports, error } = await supabase
          .from('employees')
          .select('id, name_first, name_last, job_title, department')
          .eq('reports_to', currentEmployee.id)
          .eq('is_active', true)
          .order('name_last');

        if (error) throw error;

        if (!directReports || directReports.length === 0) {
          setSubordinates([]);
          setIsLoading(false);
          return;
        }

        // Get evaluations for all direct reports for current year
        const subordinateIds = directReports.map(e => e.id);
        const { data: evaluations } = await supabase
          .from('pep_evaluations')
          .select('employee_id, status, submitted_at, updated_at, pdf_url')
          .in('employee_id', subordinateIds)
          .eq('period_year', currentYear);

        // Map evaluations to subordinates
        const evalMap = new Map(
          evaluations?.map(e => [e.employee_id, e]) || []
        );

        const subordinateStatuses: SubordinateStatus[] = directReports.map(emp => {
          const eval_ = evalMap.get(emp.id);
          return {
            id: emp.id,
            name: `${emp.name_first} ${emp.name_last}`,
            job_title: emp.job_title,
            department: emp.department,
            evaluation_status: (eval_?.status as SubordinateStatus['evaluation_status']) || 'not_started',
            submitted_at: eval_?.submitted_at || null,
            updated_at: eval_?.updated_at || null,
            pdf_url: eval_?.pdf_url || null,
          };
        });

        setSubordinates(subordinateStatuses);
      } catch (error) {
        console.error('Error loading subordinates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubordinates();
  }, [currentYear]);

  const stats = {
    total: subordinates.length,
    submitted: subordinates.filter(s => ['submitted', 'reviewed', 'signed'].includes(s.evaluation_status)).length,
    inProgress: subordinates.filter(s => ['draft', 'reopened'].includes(s.evaluation_status)).length,
    notStarted: subordinates.filter(s => s.evaluation_status === 'not_started').length,
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
                </div>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                My Evaluation
              </Link>
            </Button>
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

          {/* Team List */}
          {subordinates.length === 0 ? (
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
                  Direct Reports ({subordinates.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {subordinates.map((sub) => {
                    const config = STATUS_CONFIG[sub.evaluation_status];
                    const StatusIcon = config.icon;
                    
                    return (
                      <div
                        key={sub.id}
                        className="py-4 flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {sub.name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {sub.job_title || 'No title'} • {sub.department || 'No department'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {sub.submitted_at && (
                            <span className="text-xs text-muted-foreground hidden sm:block">
                              {new Date(sub.submitted_at).toLocaleDateString()}
                            </span>
                          )}

                          {sub.pdf_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => window.open(sub.pdf_url!, '_blank')}
                            >
                              <Download className="w-4 h-4" />
                              PDF
                            </Button>
                          )}

                          <Badge variant={config.variant} className="gap-1.5">
                            <StatusIcon className="w-3.5 h-3.5" />
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default TeamStatus;
