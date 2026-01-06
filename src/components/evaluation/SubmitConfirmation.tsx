import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, Mail, FileText, ArrowLeft } from 'lucide-react';
import { EvaluationData } from '@/types/evaluation';

interface SubmitConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onBack: () => void;
  data: EvaluationData;
  isSubmitting: boolean;
}

export const SubmitConfirmation = ({
  isOpen,
  onClose,
  onConfirm,
  onBack,
  data,
  isSubmitting,
}: SubmitConfirmationProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Submit Your Evaluation
          </DialogTitle>
          <DialogDescription>
            Please review and confirm your submission.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Employee:</span>
              <span className="font-medium">{data.employeeInfo.name || 'Not specified'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Period:</span>
              <span className="font-medium">{data.employeeInfo.periodYear}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Rating:</span>
              <span className="font-medium capitalize">
                {data.summary.overallRating?.replace('_', ' ') || 'Not specified'}
              </span>
            </div>
          </div>

          {/* What happens next */}
          <div className="space-y-2">
            <p className="text-sm font-medium">What happens next:</p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                Your evaluation will be submitted for supervisor review
              </li>
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                A confirmation copy will be sent to your email
              </li>
              <li className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                You cannot edit after submission (contact HR for changes)
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Edit
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-success hover:bg-success/90"
          >
            {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
