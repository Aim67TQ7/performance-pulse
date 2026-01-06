import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Send, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationButtonsProps {
  currentStep: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  lastSaved: Date | null;
}

export const NavigationButtons = ({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onSubmit,
  isSaving,
  lastSaved,
}: NavigationButtonsProps) => {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex flex-col gap-4 mt-8 pt-6 border-t border-border">
      {/* Save status */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Save className={cn("w-4 h-4", isSaving && "animate-pulse text-primary")} />
        {isSaving ? (
          <span>Saving...</span>
        ) : lastSaved ? (
          <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
        ) : (
          <span>Auto-save enabled</span>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={isFirstStep}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        {isLastStep ? (
          <Button
            onClick={onSubmit}
            className="flex items-center gap-2 bg-success hover:bg-success/90"
          >
            <Send className="w-4 h-4" />
            Submit Evaluation
          </Button>
        ) : (
          <Button
            onClick={onNext}
            className="flex items-center gap-2"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
