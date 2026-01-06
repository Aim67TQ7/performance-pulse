import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Home, Mail, FileText } from 'lucide-react';
import { EvaluationData } from '@/types/evaluation';
import { toast } from 'sonner';

interface SuccessScreenProps {
  data: EvaluationData;
  onReset: () => void;
}

export const SuccessScreen = ({ data, onReset }: SuccessScreenProps) => {
  const handleDownloadPdf = () => {
    if (data.pdfUrl) {
      window.open(data.pdfUrl, '_blank');
    } else {
      toast.info('PDF is being generated. Please try again in a moment.');
    }
  };

  return (
    <div className="form-section animate-scale-in text-center py-12">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 mb-6">
        <CheckCircle className="w-10 h-10 text-success" />
      </div>

      <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
        Evaluation Submitted Successfully!
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Your self-evaluation has been submitted for review. You will receive a confirmation email shortly.
      </p>

      {/* Submission details */}
      <div className="bg-secondary/30 rounded-lg p-6 max-w-sm mx-auto mb-8 text-left">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Submission Details
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Employee:</span>
            <span className="font-medium">{data.employeeInfo.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department:</span>
            <span className="font-medium">{data.employeeInfo.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Supervisor:</span>
            <span className="font-medium">{data.employeeInfo.supervisorName || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Period:</span>
            <span className="font-medium">{data.employeeInfo.periodYear}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Submitted:</span>
            <span className="font-medium">
              {data.submittedAt 
                ? new Date(data.submittedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Overall Rating:</span>
            <span className="font-medium capitalize">
              {data.summary.overallRating?.replace('_', ' ') || 'Not rated'}
            </span>
          </div>
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 max-w-sm mx-auto mb-8 text-left">
        <h3 className="font-semibold mb-3 text-primary">What's Next?</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            Check your email for confirmation
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            Your supervisor ({data.employeeInfo.supervisorName || 'manager'}) will be notified to review
          </li>
          <li className="flex items-start gap-2">
            <Download className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            {data.pdfUrl 
              ? 'Your PDF is ready for download' 
              : 'A PDF copy is being generated for HR records'
            }
          </li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
          onClick={handleDownloadPdf}
        >
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
        <Button onClick={onReset} className="flex items-center gap-2">
          <Home className="w-4 h-4" />
          Start New Evaluation
        </Button>
      </div>
    </div>
  );
};
