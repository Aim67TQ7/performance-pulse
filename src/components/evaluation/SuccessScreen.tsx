import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Home, FileText, Users, RefreshCw } from 'lucide-react';
import { EvaluationData } from '@/types/evaluation';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { generateEvaluationPdf } from '@/lib/pdfGenerator';
import { supabase } from '@/integrations/supabase/client';

interface SuccessScreenProps {
  data: EvaluationData;
  hasSubordinates?: boolean;
}

function downloadUrl(url: string, filename: string) {
  // For remote URLs, fetch as blob to trigger proper download
  if (/^https?:\/\//.test(url)) {
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        // Fallback: open in new tab if fetch fails
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    return;
  }
  // For blob: URLs, download directly
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const SuccessScreen = ({ data, hasSubordinates = false }: SuccessScreenProps) => {
  const navigate = useNavigate();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dbPdfUrl, setDbPdfUrl] = useState<string | null>(null);

  // Fetch pdf_url from database on mount to survive refresh
  useEffect(() => {
    const fetchPdfUrl = async () => {
      if (!data.id) return;
      
      const { data: evalData } = await supabase
        .from('pep_evaluations')
        .select('pdf_url')
        .eq('id', data.id)
        .single();
      
      if (evalData?.pdf_url && /^https?:\/\//.test(evalData.pdf_url)) {
        setDbPdfUrl(evalData.pdf_url);
      }
    };
    
    fetchPdfUrl();
  }, [data.id]);

  const filename = useMemo(() => {
    const name = (data.employeeInfo?.name || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
    const year = data.employeeInfo?.periodYear ?? new Date().getFullYear();
    return `PEP_${name}_${year}.pdf`;
  }, [data.employeeInfo?.name, data.employeeInfo?.periodYear]);

  // Priority: freshly generated > DB stored > prop passed
  const effectivePdfUrl = generatedUrl ?? dbPdfUrl ?? data.pdfUrl ?? null;

  const handleDownloadPdf = () => {
    if (!effectivePdfUrl) {
      toast.error('PDF not available yet. Click "Generate PDF" to create it now.');
      return;
    }
    downloadUrl(effectivePdfUrl, filename);
  };

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      const url = await generateEvaluationPdf(data);
      setGeneratedUrl(url);

      const isRemote = /^https?:\/\//.test(url);
      if (isRemote) {
        setDbPdfUrl(url); // Update local state so it persists in UI
      }
      toast.success(isRemote ? 'PDF generated and saved successfully.' : 'PDF generated (save to storage failed).');

      // Immediately download after generation
      downloadUrl(url, filename);
    } catch (e) {
      console.error('PDF generation failed:', e);
      toast.error('PDF generation failed. Please try again or contact HR.');
    } finally {
      setIsGenerating(false);
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
        Your self-assessment has been submitted and is now available for your supervisor to review.
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
          {effectivePdfUrl ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-success" />
              PDF ready for download
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              PDF not available yet — generate it now
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
          onClick={handleDownloadPdf}
          disabled={!effectivePdfUrl}
        >
          <Download className="w-4 h-4" />
          Download PDF
        </Button>

        {!effectivePdfUrl && (
          <Button
            variant="default"
            className="flex items-center gap-2"
            onClick={handleGeneratePdf}
            disabled={isGenerating}
          >
            <RefreshCw className={"w-4 h-4" + (isGenerating ? ' animate-spin' : '')} />
            {isGenerating ? 'Generating…' : 'Generate PDF'}
          </Button>
        )}

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
