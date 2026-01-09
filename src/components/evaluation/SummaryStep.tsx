import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EvaluationData, RATING_OPTIONS, OverallRating } from '@/types/evaluation';
import { RatingSelector } from './RatingSelector';
import { FileText, Award } from 'lucide-react';

interface SummaryStepProps {
  data: EvaluationData['summary'];
  onUpdate: (updates: Partial<EvaluationData['summary']>) => void;
}

export const SummaryStep = ({ data, onUpdate }: SummaryStepProps) => {
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
        <div className="space-y-3">
          <Label htmlFor="summary" className="flex items-center gap-2 text-base font-medium">
            <FileText className="w-5 h-5 text-primary" />
            Employee Summary
          </Label>
          <p className="text-sm text-muted-foreground">
            Provide a comprehensive self-assessment narrative summarizing your performance during this period.
          </p>
          <Textarea
            id="summary"
            value={data.employeeSummary}
            onChange={(e) => onUpdate({ employeeSummary: e.target.value })}
            placeholder="Summarize your overall performance, key contributions, challenges faced, and lessons learned during this evaluation period..."
            className="min-h-[200px] resize-y"
          />
        </div>

        {/* Overall Rating */}
        <div className="pt-6 border-t border-border">
          <Label className="flex items-center gap-2 text-base font-medium mb-4">
            <Award className="w-5 h-5 text-success" />
            Overall Self-Evaluation Rating
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
