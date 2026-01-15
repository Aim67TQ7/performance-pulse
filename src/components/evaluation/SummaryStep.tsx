import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EvaluationData, RATING_OPTIONS, OverallRating } from '@/types/evaluation';
import { RatingSelector } from './RatingSelector';
import { FileText, Award } from 'lucide-react';

interface SummaryStepProps {
  data: EvaluationData['summary'];
  onUpdate: (updates: Partial<EvaluationData['summary']>) => void;
  showErrors?: boolean;
}

export const SummaryStep = ({ data, onUpdate, showErrors = false }: SummaryStepProps) => {
  const summaryError = showErrors && !data.employeeSummary?.trim();
  const ratingError = showErrors && !data.overallRating;
  
  return (
    <div className="form-section animate-slide-up">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
          Section IV: Employee Summary
        </h2>
        <p className="text-muted-foreground">
          Provide your overall self-assessment narrative summarizing your performance.
        </p>
      </div>

      <div className="space-y-8">
        {/* Employee Summary */}
        <div className={`space-y-3 ${summaryError ? 'ring-2 ring-destructive/50 rounded-lg p-4 -m-4' : ''}`}>
          <Label htmlFor="summary" className={`flex items-center gap-2 text-base font-medium ${summaryError ? 'text-destructive' : ''}`}>
            <FileText className={`w-5 h-5 ${summaryError ? 'text-destructive' : 'text-primary'}`} />
            Employee Summary
            <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">
            Provide a comprehensive self-assessment narrative summarizing your performance during this period.
          </p>
          <Textarea
            id="summary"
            value={data.employeeSummary}
            onChange={(e) => onUpdate({ employeeSummary: e.target.value })}
            placeholder="Summarize your overall performance, key contributions, challenges faced, and lessons learned during this evaluation period..."
            className={`min-h-[200px] resize-y ${summaryError ? 'border-destructive' : ''}`}
          />
        </div>

        {/* Overall Rating */}
        <div className={`pt-6 border-t border-border ${ratingError ? 'ring-2 ring-destructive/50 rounded-lg p-4' : ''}`}>
          <Label className={`flex items-center gap-2 text-base font-medium mb-4 ${ratingError ? 'text-destructive' : ''}`}>
            <Award className={`w-5 h-5 ${ratingError ? 'text-destructive' : 'text-success'}`} />
            Overall Self-Evaluation Rating
            <span className="text-destructive">*</span>
          </Label>
          <RatingSelector
            value={data.overallRating}
            onChange={(rating) => onUpdate({ overallRating: rating as OverallRating })}
            options={RATING_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
};
