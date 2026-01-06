import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EvaluationData, RATING_OPTIONS, OverallRating } from '@/types/evaluation';
import { RatingSelector } from './RatingSelector';
import { Target, Trophy, BookOpen } from 'lucide-react';

interface QuantitativeStepProps {
  data: EvaluationData['quantitative'];
  onUpdate: (updates: Partial<EvaluationData['quantitative']>) => void;
}

export const QuantitativeStep = ({ data, onUpdate }: QuantitativeStepProps) => {
  return (
    <div className="form-section animate-slide-up">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
          A. Quantitative Self-Evaluation
        </h2>
        <p className="text-muted-foreground">
          Describe your key achievements and objectives for this evaluation period.
        </p>
      </div>

      <div className="space-y-8">
        {/* Performance Objectives */}
        <div className="space-y-3">
          <Label htmlFor="objectives" className="flex items-center gap-2 text-base font-medium">
            <Target className="w-5 h-5 text-primary" />
            Performance Objectives
          </Label>
          <p className="text-sm text-muted-foreground">
            List your key performance objectives and the results you achieved against each one.
          </p>
          <Textarea
            id="objectives"
            value={data.performanceObjectives}
            onChange={(e) => onUpdate({ performanceObjectives: e.target.value })}
            placeholder="• Objective 1: [Description] - Result: [Achieved/Exceeded/Not Met]&#10;• Objective 2: [Description] - Result: [Achieved/Exceeded/Not Met]&#10;• Objective 3: [Description] - Result: [Achieved/Exceeded/Not Met]"
            className="min-h-[180px] resize-y"
          />
          <p className="text-xs text-muted-foreground text-right">
            Aim for 3-5 bullet points
          </p>
        </div>

        {/* Work Accomplishments */}
        <div className="space-y-3">
          <Label htmlFor="accomplishments" className="flex items-center gap-2 text-base font-medium">
            <Trophy className="w-5 h-5 text-warning" />
            Work Accomplishments
          </Label>
          <p className="text-sm text-muted-foreground">
            Describe your major work accomplishments and contributions during this period.
          </p>
          <Textarea
            id="accomplishments"
            value={data.workAccomplishments}
            onChange={(e) => onUpdate({ workAccomplishments: e.target.value })}
            placeholder="• Successfully completed [project/initiative]&#10;• Improved [process/outcome] by [metric]&#10;• Led team to achieve [goal]"
            className="min-h-[180px] resize-y"
          />
          <p className="text-xs text-muted-foreground text-right">
            Aim for 3-5 bullet points
          </p>
        </div>

        {/* Personal Development */}
        <div className="space-y-3">
          <Label htmlFor="development" className="flex items-center gap-2 text-base font-medium">
            <BookOpen className="w-5 h-5 text-accent" />
            Personal Development
          </Label>
          <p className="text-sm text-muted-foreground">
            Describe your personal development activities, training, and growth initiatives.
          </p>
          <Textarea
            id="development"
            value={data.personalDevelopment}
            onChange={(e) => onUpdate({ personalDevelopment: e.target.value })}
            placeholder="• Completed [training/certification]&#10;• Developed skills in [area]&#10;• Mentored [colleague/team member]"
            className="min-h-[180px] resize-y"
          />
          <p className="text-xs text-muted-foreground text-right">
            Aim for 3-5 bullet points
          </p>
        </div>

        {/* Quantitative Rating */}
        <div className="pt-6 border-t border-border">
          <Label className="text-base font-medium mb-4 block">
            Objective/Quantitative Self-Evaluation Rating
          </Label>
          <RatingSelector
            value={data.quantitativeRating}
            onChange={(rating) => onUpdate({ quantitativeRating: rating as OverallRating })}
            options={RATING_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
};
