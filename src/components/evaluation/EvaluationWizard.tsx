import { useState, useMemo } from 'react';
import { ProgressHeader } from './ProgressHeader';
import { EmployeeInfoStep } from './EmployeeInfoStep';
import { QuantitativeStep } from './QuantitativeStep';
import { QualitativeStep } from './QualitativeStep';
import { SummaryStep } from './SummaryStep';
import { NavigationButtons } from './NavigationButtons';
import { SubmitConfirmation } from './SubmitConfirmation';
import { SuccessScreen } from './SuccessScreen';
import { ErrorLogPanel } from './ErrorLogPanel';
import { useEvaluation } from '@/hooks/useEvaluation';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Employee Info', shortTitle: 'Info' },
  { id: 2, title: 'Quantitative', shortTitle: 'Quant.' },
  { id: 3, title: 'Qualitative', shortTitle: 'Qual.' },
  { id: 4, title: 'Summary', shortTitle: 'Summary' },
];

export const EvaluationWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data,
    isSaving,
    lastSaved,
    updateEmployeeInfo,
    updateQuantitative,
    updateQualitative,
    updateSummary,
    submitEvaluation,
    resetEvaluation,
    calculateProgress,
  } = useEvaluation();

  const { errors, resolveError, clearErrors } = useErrorLogger();

  const { sections, total: progress } = useMemo(() => calculateProgress(), [calculateProgress]);

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

  const handleReset = () => {
    resetEvaluation();
    setCurrentStep(1);
  };

  // Show success screen if submitted
  if (data.status === 'submitted') {
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
          <EmployeeInfoStep data={data.employeeInfo} onUpdate={updateEmployeeInfo} />
        )}
        {currentStep === 2 && (
          <QuantitativeStep data={data.quantitative} onUpdate={updateQuantitative} />
        )}
        {currentStep === 3 && (
          <QualitativeStep data={data.qualitative} onUpdate={updateQualitative} />
        )}
        {currentStep === 4 && (
          <SummaryStep data={data.summary} onUpdate={updateSummary} />
        )}

        {/* Navigation */}
        <NavigationButtons
          currentStep={currentStep}
          totalSteps={STEPS.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSubmit={handleSubmitClick}
          isSaving={isSaving}
          lastSaved={lastSaved}
        />

        {/* Submit confirmation dialog */}
        <SubmitConfirmation
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={handleConfirmSubmit}
          onBack={() => setShowConfirmation(false)}
          data={data}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
};
