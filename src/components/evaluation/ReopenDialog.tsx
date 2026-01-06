import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface ReopenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
  employeeName: string;
}

export const ReopenDialog = ({ isOpen, onClose, onConfirm, employeeName }: ReopenDialogProps) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    
    setIsSubmitting(true);
    const success = await onConfirm(reason);
    setIsSubmitting(false);
    
    if (success) {
      setReason('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-warning/10">
              <RotateCcw className="w-5 h-5 text-warning" />
            </div>
            <div>
              <DialogTitle>Reopen Evaluation</DialogTitle>
              <DialogDescription>
                Allow {employeeName} to revise their evaluation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Reopening this evaluation will allow the employee to make changes. 
              A new PDF will be generated when they resubmit.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reopen-reason">Reason for Reopening *</Label>
            <Textarea
              id="reopen-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why this evaluation needs revision..."
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be recorded and visible to the employee.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!reason.trim() || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? 'Reopening...' : 'Reopen for Revision'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
