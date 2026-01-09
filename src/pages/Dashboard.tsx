import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, Users, CheckCircle, ArrowRight, Settings } from 'lucide-react';
import { VersionBadge } from '@/components/version/VersionBadge';
import { SuccessScreen } from '@/components/evaluation/SuccessScreen';
import { EvaluationData, EmployeeInfo, QuantitativeData, QualitativeFactors, SummaryData } from '@/types/evaluation';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasSubordinates, setHasSubordinates] = useState(false);
  const [evaluationStatus, setEvaluationStatus] = useState<'none' | 'draft' | 'submitted' | 'reopened'>('none');
  const [evaluationData, setEvaluationData] = useState<EvaluationData | null>(null);
  const [isHrAdmin, setIsHrAdmin] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Get current user's employee record
        const { data: currentUserEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!currentUserEmployee) {
          setIsLoading(false);
          return;
        }

        // Check if user has any direct reports
        const { count } = await supabase
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('reports_to', currentUserEmployee.id)
          .eq('benefit_class', 'salary')
          .eq('is_active', true);

        setHasSubordinates((count || 0) > 0);

        // Check if user is an HR Admin
        const { data: hrAdminRecord } = await supabase
          .from('hr_admin_users')
          .select('id')
          .eq('employee_id', currentUserEmployee.id)
          .maybeSingle();

        setIsHrAdmin(!!hrAdminRecord);

        // Hardcoded assessment year - do not change without HR approval
        const ASSESSMENT_YEAR = 2025;
        const { data: evaluation } = await supabase
          .from('pep_evaluations')
          .select('*')
          .eq('employee_id', currentUserEmployee.id)
          .eq('period_year', ASSESSMENT_YEAR)
          .single();

        if (evaluation) {
          setEvaluationStatus(evaluation.status as 'draft' | 'submitted' | 'reopened');
          
          // Parse JSON fields from the database
          const employeeInfo = evaluation.employee_info_json as unknown as EmployeeInfo || {
            name: '',
            title: '',
            department: '',
            periodYear: ASSESSMENT_YEAR,
          };
          const quantitative = evaluation.quantitative_json as unknown as QuantitativeData || {
            performanceObjectives: '',
            workAccomplishments: '',
            personalDevelopment: '',
            quantitativeRating: null,
            competencies: [],
            overallQuantitativeRating: null,
          };
          const qualitative = (evaluation.qualitative_json as unknown as QualitativeFactors) || {
            forecastingPlanningSkills: null,
            administrationSkills: null,
            leadership: null,
            safety: null,
            developingEmployees: null,
            communicationSkills: null,
            developingCooperationTeamwork: null,
            customerSatisfaction: null,
            peerRelationships: null,
            subordinateRelationships: null,
            jobKnowledgeKnowHow: null,
            qualityImage: null,
            attitude: null,
            decisionMaking: null,
            creativityInitiative: null,
          };
          const summary = (evaluation.summary_json as unknown as SummaryData) || {
            employeeSummary: '',
            targetsForNextYear: '',
            qualitativeRating: null,
            overallRating: null,
          };

          setEvaluationData({
            id: evaluation.id,
            employeeId: evaluation.employee_id,
            status: evaluation.status as 'draft' | 'submitted' | 'reopened',
            submittedAt: evaluation.submitted_at ? new Date(evaluation.submitted_at) : undefined,
            pdfUrl: evaluation.pdf_url || undefined,
            employeeInfo,
            quantitative,
            qualitative,
            summary,
          });
        } else {
          setEvaluationStatus('none');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Non-manager with no submitted evaluation -> redirect to evaluation
  if (!hasSubordinates && (evaluationStatus === 'none' || evaluationStatus === 'draft' || evaluationStatus === 'reopened')) {
    navigate('/evaluation');
    return null;
  }

  // Non-manager with submitted evaluation -> show success screen
  if (!hasSubordinates && evaluationStatus === 'submitted' && evaluationData) {
    return (
      <>
        <Helmet>
          <title>Evaluation Complete | Bunting PEP</title>
        </Helmet>
        <div className="min-h-screen bg-background py-8 px-4">
          <div className="max-w-3xl mx-auto">
            <SuccessScreen data={evaluationData} hasSubordinates={false} />
          </div>
        </div>
      </>
    );
  }

  // Manager dashboard
  return (
    <>
      <Helmet>
        <title>Dashboard | Bunting PEP</title>
        <meta name="description" content="Performance Evaluation Process dashboard for managers" />
      </Helmet>
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <img 
              src="/bunting-logo.png" 
              alt="Bunting Magnetics" 
              className="h-14 w-auto"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
                Performance Evaluation Process
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-muted-foreground text-sm">
                  Bunting Magnetics – Manager Dashboard
                </p>
                <span className="text-muted-foreground">•</span>
                <VersionBadge />
              </div>
            </div>
          </div>

          {/* Dashboard Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Self Assessment Card */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  {evaluationStatus === 'submitted' ? (
                    <div className="p-2 rounded-lg bg-success/10">
                      <CheckCircle className="w-6 h-6 text-success" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <CardTitle>My Self-Evaluation</CardTitle>
                    <CardDescription>
                      {evaluationStatus === 'submitted' 
                        ? 'Your evaluation has been submitted'
                        : evaluationStatus === 'reopened'
                        ? 'Your evaluation needs revision'
                        : 'Complete your annual self-assessment'
                      }
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {evaluationStatus === 'submitted' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Submitted on{' '}
                      {evaluationData?.submittedAt
                        ? new Date(evaluationData.submittedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                    <Button variant="outline" onClick={() => navigate('/evaluation')} className="w-full gap-2">
                      View Submitted Evaluation
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => navigate('/evaluation')} className="w-full gap-2">
                    {evaluationStatus === 'reopened' ? 'Continue Revision' : evaluationStatus === 'draft' ? 'Continue Evaluation' : 'Start Evaluation'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Team Status Card */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <Users className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <CardTitle>Team Status</CardTitle>
                    <CardDescription>
                      Monitor your team's evaluation progress
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  View and manage the self-review submissions of your direct reports.
                </p>
                <Button variant="outline" onClick={() => navigate('/team-status')} className="w-full gap-2">
                  View Team Status
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            {/* HR Administration Card - Only visible to authorized HR admins */}
            {isHrAdmin && (
              <Card className="relative overflow-hidden md:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Settings className="w-6 h-6 text-foreground" />
                    </div>
                    <div>
                      <CardTitle>HR Administration</CardTitle>
                      <CardDescription>
                        Manage assessment dates and send company-wide notifications
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Configure the evaluation period settings and send email notifications to all employees.
                  </p>
                  <Button variant="outline" onClick={() => navigate('/hr-admin')} className="gap-2">
                    Open HR Admin
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
