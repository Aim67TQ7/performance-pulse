import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Home, FileText, Users, Loader2 } from 'lucide-react';
import { EvaluationData } from '@/types/evaluation';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SuccessScreenProps {
  data: EvaluationData;
  hasSubordinates?: boolean;
}

export const SuccessScreen = ({ data, hasSubordinates = false }: SuccessScreenProps) => {
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState<string | undefined>(data.pdfUrl);
  const [isPolling, setIsPolling] = useState(!data.pdfUrl);

  // Poll for PDF URL if not available
  useEffect(() => {
    if (pdfUrl || !data.id) return;

    let attempts = 0;
    const maxAttempts = 10;
    
    const pollForPdf = async () => {
      attempts++;
      const { data: evalData } = await supabase
        .from('pep_evaluations')
        .select('pdf_url')
        .eq('id', data.id)
        .single();
      
      if (evalData?.pdf_url) {
        setPdfUrl(evalData.pdf_url);
        setIsPolling(false);
        return true;
      }
      
      if (attempts >= maxAttempts) {
        setIsPolling(false);
        return true;
      }
      
      return false;
    };

    const interval = setInterval(async () => {
      const done = await pollForPdf();
      if (done) clearInterval(interval);
    }, 2000);

    // Initial check
    pollForPdf();

    return () => clearInterval(interval);
  }, [data.id, pdfUrl]);

  const handleDownloadPdf = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else if (isPolling) {
      toast.info('PDF is still being generated. Please wait a moment.');
    } else {
      toast.error('PDF generation failed. Please contact HR.');
    }
  };

  return (
    <div className="form-section animate-scale-in text-center py-12">
      <img 
        src="/bunting-logo.png" 
        alt="Bunting Magnetics" 
        className="h-12 w-auto mx-auto mb-6"
      />
      
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 mb-6">
        <CheckCircle className="w-10 h-10 text-success" />
      </div>

      <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
        Evaluation Submitted Successfully!
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Your self-evaluation has been submitted and is now available for your supervisor to review.
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

      {/* PDF Status */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 max-w-sm mx-auto mb-8 text-left">
        <h3 className="font-semibold mb-3 text-primary">PDF Document</h3>
        <div className="text-sm text-muted-foreground">
          {isPolling ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating PDF document...
            </div>
          ) : pdfUrl ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              PDF ready for download
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              PDF will be available shortly
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
          onClick={handleDownloadPdf}
          disabled={isPolling}
        >
          {isPolling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isPolling ? 'Generating...' : 'Download PDF'}
        </Button>
        {hasSubordinates && (
          <>
            <Button 
              variant="outline" 
              onClick={() => navigate('/team-status')} 
              className="flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              View Team Status
            </Button>
            <Button onClick={() => navigate('/')} className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
