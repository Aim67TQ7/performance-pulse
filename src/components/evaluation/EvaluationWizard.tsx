import { useState, useMemo, useEffect } from 'react';
import { ProgressHeader } from './ProgressHeader';
import { EmployeeInfoStep } from './EmployeeInfoStep';
import { QuantitativeStep } from './QuantitativeStep';
import { QualitativeStep } from './QualitativeStep';
import { SummaryStep } from './SummaryStep';
import { NavigationButtons } from './NavigationButtons';
import { SubmitConfirmation } from './SubmitConfirmation';
import { SuccessScreen } from './SuccessScreen';
import { ErrorLogPanel } from './ErrorLogPanel';
import { ReopenDialog } from './ReopenDialog';
import { VersionBadge } from '@/components/version/VersionBadge';
import { useEvaluation } from '@/hooks/useEvaluation';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, RotateCcw, AlertTriangle, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

const STEPS = [
  { id: 1, title: 'Employee Info', shortTitle: 'Info' },
  { id: 2, title: 'Quantitative', shortTitle: 'Quant.' },
  { id: 3, title: 'Qualitative', shortTitle: 'Qual.' },
  { id: 4, title: 'Summary', shortTitle: 'Summary' },
];

export const EvaluationWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canReopen, setCanReopen] = useState(false);
  const [hasSubordinates, setHasSubordinates] = useState(false);

  const {
    data,
    isSaving,
    lastSaved,
    isLoading,
    isReadOnly,
    currentEmployee,
    updateEmployeeInfo,
    updateQuantitative,
    updateQualitative,
    updateSummary,
    submitEvaluation,
    reopenEvaluation,
    resetEvaluation,
    calculateProgress,
  } = useEvaluation();

  const { errors, resolveError, clearErrors } = useErrorLogger();

  const { sections, total: progress } = useMemo(() => calculateProgress(), [calculateProgress]);

  // Check if current user has subordinates and if they can reopen evaluations
  useEffect(() => {
    const checkUserAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get current user's employee record
        const { data: currentUserEmployee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!currentUserEmployee) return;

        // Check if user has any direct reports
        const { count } = await supabase
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('reports_to', currentUserEmployee.id)
          .eq('is_active', true);

        setHasSubordinates((count || 0) > 0);

        // Check if can reopen (only if viewing a submitted evaluation)
        if (data.employeeId && data.status !== 'draft' && data.status !== 'reopened') {
          const { data: evalOwner } = await supabase
            .from('employees')
            .select('reports_to')
            .eq('id', data.employeeId)
            .single();

          setCanReopen(evalOwner?.reports_to === currentUserEmployee.id);
        } else {
          setCanReopen(false);
        }
      } catch (error) {
        console.error('Error checking user access:', error);
      }
    };

    checkUserAccess();
  }, [data.employeeId, data.status]);

  const completedSteps = useMemo(() => {
    const completed: number[] = [];
    if (sections.employeeInfo >= 0.75) completed.push(1);
    if (sections.quantitative >= 0.75) completed.push(2);
    if (sections.qualitative >= 0.6) completed.push(3);
    if (sections.summary >= 0.75) completed.push(4);
    return completed;
  }, [sections]);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    const result = await submitEvaluation();
    setIsSubmitting(false);

    if (result.success) {
      setShowConfirmation(false);
      toast.success('Evaluation submitted successfully!');
    } else {
      toast.error('Submission failed. Please try again.');
    }
  };

  const handleReopen = async (reason: string) => {
    const success = await reopenEvaluation(reason);
    if (success) {
      toast.success('Evaluation reopened for revision');
    }
    return success;
  };

  const handleReset = () => {
    resetEvaluation();
    setCurrentStep(1);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading evaluation...</p>
        </div>
      </div>
    );
  }

  // Show success screen if submitted
  if (data.status === 'submitted' && !canReopen) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <SuccessScreen data={data} hasSubordinates={hasSubordinates} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
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
                Performance Self-Evaluation
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-muted-foreground text-sm">
                  Bunting Magnetics – Salaried Employees
                </p>
                <span className="text-muted-foreground">•</span>
                <VersionBadge />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasSubordinates && (
              <Button variant="outline" asChild>
                <Link to="/team-status" className="gap-2">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Team Status</span>
                </Link>
              </Button>
            )}
            <ErrorLogPanel
              errors={errors}
              onResolve={resolveError}
              onClear={clearErrors}
            />
          </div>
        </div>

        {/* Read-only banner */}
        {isReadOnly && (
          <div className="mb-6 p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-foreground">Evaluation Locked</p>
                <p className="text-sm text-muted-foreground">
                  This evaluation has been submitted and cannot be edited.
                </p>
              </div>
            </div>
            {canReopen && (
              <Button 
                variant="outline" 
                onClick={() => setShowReopenDialog(true)}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reopen for Revision
              </Button>
            )}
          </div>
        )}

        {/* Reopened banner */}
        {data.status === 'reopened' && data.reopenReason && (
          <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Evaluation Reopened for Revision</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>Manager's note:</strong> {data.reopenReason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress header */}
        <ProgressHeader
          steps={STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          progress={progress}
          onStepClick={handleStepClick}
        />

        {/* Step content */}
        {currentStep === 1 && (
          <EmployeeInfoStep 
            data={data.employeeInfo} 
            onUpdate={updateEmployeeInfo} 
            isReadOnly={isReadOnly}
          />
        )}
        {currentStep === 2 && (
          <QuantitativeStep 
            data={data.quantitative} 
            onUpdate={updateQuantitative} 
          />
        )}
        {currentStep === 3 && (
          <QualitativeStep 
            data={data.qualitative} 
            onUpdate={updateQualitative} 
          />
        )}
        {currentStep === 4 && (
          <SummaryStep 
            data={data.summary} 
            onUpdate={updateSummary} 
          />
        )}

        {/* Navigation */}
        {!isReadOnly && (
          <NavigationButtons
            currentStep={currentStep}
            totalSteps={STEPS.length}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSubmit={handleSubmitClick}
            isSaving={isSaving}
            lastSaved={lastSaved}
          />
        )}

        {/* Submit confirmation dialog */}
        <SubmitConfirmation
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={handleConfirmSubmit}
          onBack={() => setShowConfirmation(false)}
          data={data}
          isSubmitting={isSubmitting}
        />

        {/* Reopen dialog for managers */}
        <ReopenDialog
          isOpen={showReopenDialog}
          onClose={() => setShowReopenDialog(false)}
          onConfirm={handleReopen}
          employeeName={data.employeeInfo.name}
        />
      </div>
    </div>
  );
};
