import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EvaluationData, RATING_OPTIONS, OverallRating } from '@/types/evaluation';
import { RatingSelector } from './RatingSelector';
import { FileText, Target, Star, Award } from 'lucide-react';

interface SummaryStepProps {
  data: EvaluationData['summary'];
  onUpdate: (updates: Partial<EvaluationData['summary']>) => void;
}

export const SummaryStep = ({ data, onUpdate }: SummaryStepProps) => {
  return (
    <div className="form-section animate-slide-up">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
          C. Employee Summary & Overall Evaluation
        </h2>
        <p className="text-muted-foreground">
          Provide your overall self-assessment and set targets for the next evaluation period.
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

        {/* Targets for Next Year */}
        <div className="space-y-3">
          <Label htmlFor="targets" className="flex items-center gap-2 text-base font-medium">
            <Target className="w-5 h-5 text-accent" />
            Targets for Next Year
          </Label>
          <p className="text-sm text-muted-foreground">
            Outline your goals and objectives for the upcoming evaluation period.
          </p>
          <Textarea
            id="targets"
            value={data.targetsForNextYear}
            onChange={(e) => onUpdate({ targetsForNextYear: e.target.value })}
            placeholder="• Goal 1: [Description]&#10;• Goal 2: [Description]&#10;• Development focus: [Area to improve]"
            className="min-h-[150px] resize-y"
          />
        </div>

        {/* Qualitative Rating */}
        <div className="pt-6 border-t border-border">
          <Label className="flex items-center gap-2 text-base font-medium mb-4">
            <Star className="w-5 h-5 text-warning" />
            Subjective/Qualitative Self-Evaluation Rating
          </Label>
          <RatingSelector
            value={data.qualitativeRating}
            onChange={(rating) => onUpdate({ qualitativeRating: rating as OverallRating })}
            options={RATING_OPTIONS}
          />
        </div>

        {/* Overall Rating */}
        <div className="pt-6 border-t border-border">
          <Label className="flex items-center gap-2 text-base font-medium mb-4">
            <Award className="w-5 h-5 text-success" />
            Overall Self-Evaluation (Quantitative and Qualitative Combined)
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
