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
import { useEvaluation } from '@/hooks/useEvaluation';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, RotateCcw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

  // Check if current user is the manager of this evaluation's owner
  useEffect(() => {
    const checkManagerAccess = async () => {
      if (!data.employeeId || data.status === 'draft' || data.status === 'reopened') {
        setCanReopen(false);
        return;
      }

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

        // Get the evaluation owner's reports_to
        const { data: evalOwner } = await supabase
          .from('employees')
          .select('reports_to')
          .eq('id', data.employeeId)
          .single();

        // Check if current user is the direct manager
        setCanReopen(evalOwner?.reports_to === currentUserEmployee.id);
      } catch (error) {
        console.error('Error checking manager access:', error);
      }
    };

    checkManagerAccess();
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
    const success = await submitEvaluation();
    setIsSubmitting(false);

    if (success) {
      setShowConfirmation(false);
      toast.success('Evaluation submitted successfully!');
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
          <SuccessScreen data={data} onReset={handleReset} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-semibold text-foreground">
              Performance Self-Evaluation
            </h1>
            <p className="text-muted-foreground mt-1">
              Bunting Salaried Employees
            </p>
          </div>
          <ErrorLogPanel
            errors={errors}
            onResolve={resolveError}
            onClear={clearErrors}
          />
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
