import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  title: string;
  shortTitle: string;
}

interface ProgressHeaderProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  progress: number;
  onStepClick: (step: number) => void;
}

export const ProgressHeader = ({
  steps,
  currentStep,
  completedSteps,
  progress,
  onStepClick,
}: ProgressHeaderProps) => {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-4 mb-6">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Overall Progress</span>
          <span className="text-sm font-semibold text-primary">{progress}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full progress-gradient transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isPending = !isCompleted && !isCurrent;

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className={cn(
                "flex flex-col items-center gap-2 transition-all duration-200 group",
                isPending && "opacity-50 hover:opacity-75"
              )}
            >
              <div
                className={cn(
                  "step-indicator",
                  isCompleted && "completed",
                  isCurrent && "active",
                  isPending && "pending"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden md:block transition-colors",
                  isCurrent && "text-primary",
                  isCompleted && "text-success",
                  isPending && "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
              <span
                className={cn(
                  "text-xs font-medium md:hidden transition-colors",
                  isCurrent && "text-primary",
                  isCompleted && "text-success",
                  isPending && "text-muted-foreground"
                )}
              >
                {step.shortTitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
