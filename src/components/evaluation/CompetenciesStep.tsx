import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { EvaluationData, Competency, RATING_OPTIONS, OverallRating } from '@/types/evaluation';
import { RatingSelector } from './RatingSelector';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Award } from 'lucide-react';

interface CompetenciesStepProps {
  data: EvaluationData['quantitative'];
  onUpdate: (updates: Partial<EvaluationData['quantitative']>) => void;
  showErrors?: boolean;
}

export const CompetenciesStep = ({ data, onUpdate, showErrors = false }: CompetenciesStepProps) => {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Validation helper
  const overallRatingError = showErrors && !data.overallQuantitativeRating;

  // Fetch competencies from database
  useEffect(() => {
    const fetchCompetencies = async () => {
      try {
        const { data: competencyData, error } = await supabase
          .from('pep_competencies')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (error) throw error;
        
        setCompetencies(competencyData || []);

        // Initialize competency ratings if not present
        if (competencyData && (!data.competencies || data.competencies.length === 0)) {
          const initialRatings = competencyData.map(c => ({
            competencyId: c.id,
            competencyName: c.name,
            score: null,
            comments: '',
          }));
          onUpdate({ competencies: initialRatings });
        }
      } catch (error) {
        console.error('Failed to load competencies:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompetencies();
  }, []);

  const updateCompetencyRating = (competencyId: string, competencyName: string, score: number | null) => {
    const existing = data.competencies || [];
    const index = existing.findIndex(c => c.competencyId === competencyId);
    
    if (index >= 0) {
      const updated = [...existing];
      updated[index] = { ...updated[index], score };
      onUpdate({ competencies: updated });
    } else {
      onUpdate({
        competencies: [...existing, { competencyId, competencyName, score, comments: '' }]
      });
    }
  };

  const updateCompetencyComments = (competencyId: string, competencyName: string, comments: string) => {
    const existing = data.competencies || [];
    const index = existing.findIndex(c => c.competencyId === competencyId);
    
    if (index >= 0) {
      const updated = [...existing];
      updated[index] = { ...updated[index], comments };
      onUpdate({ competencies: updated });
    } else {
      onUpdate({
        competencies: [...existing, { competencyId, competencyName, score: null, comments }]
      });
    }
  };

  const getCompetencyRating = (competencyId: string) => {
    return data.competencies?.find(c => c.competencyId === competencyId);
  };

  if (isLoading) {
    return (
      <div className="form-section animate-slide-up flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading competencies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-section animate-slide-up">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold text-foreground mb-2 flex items-center gap-2">
          <Award className="w-6 h-6 text-primary" />
          A. Performance Competencies Evaluation
        </h2>
        <p className="text-muted-foreground">
          Rate yourself on each competency and provide specific examples or comments.
        </p>
      </div>

      {/* Rating Scale Legend */}
      <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border">
        <p className="text-sm font-medium text-foreground mb-2">Rating Scale:</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <span><strong>1</strong> = Needs Improvement</span>
          <span><strong>2</strong> = Below Average</span>
          <span><strong>3</strong> = Average</span>
          <span><strong>4</strong> = Above Average</span>
          <span><strong>5</strong> = Excellent</span>
        </div>
      </div>

      {/* Competencies Table */}
      <div className="space-y-6">
        {competencies.map((competency) => {
          const rating = getCompetencyRating(competency.id);
          const scoreError = showErrors && (rating?.score === null || rating?.score === undefined);
          const commentsError = showErrors && !rating?.comments?.trim();
          const hasError = scoreError || commentsError;
          
          return (
            <div 
              key={competency.id} 
              className={`border rounded-lg overflow-hidden bg-card ${hasError ? 'border-destructive ring-2 ring-destructive/30' : 'border-border'}`}
            >
              {/* Competency Header */}
              <div className="bg-muted/50 px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-foreground">{competency.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{competency.definition}</p>
              </div>

              {/* Observable Behaviors */}
              <div className="px-4 py-3 border-b border-border bg-background">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Observable Behaviors
                </p>
                <p className="text-sm text-foreground">{competency.observable_behaviors}</p>
              </div>

              {/* Rating and Comments */}
              <div className="p-4 space-y-4">
                {/* Score Selection */}
                <div>
                  <Label className={`text-sm font-medium mb-2 block ${scoreError ? 'text-destructive' : ''}`}>
                    Self-Rating <span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup
                    value={rating?.score?.toString() || ''}
                    onValueChange={(value) => 
                      updateCompetencyRating(competency.id, competency.name, parseInt(value))
                    }
                    className="flex gap-4"
                  >
                    {[1, 2, 3, 4, 5].map((score) => (
                      <div key={score} className="flex items-center">
                        <RadioGroupItem
                          value={score.toString()}
                          id={`${competency.id}-score-${score}`}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={`${competency.id}-score-${score}`}
                          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 bg-background text-sm font-medium transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground hover:border-primary/50 ${scoreError ? 'border-destructive' : 'border-border'}`}
                        >
                          {score}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Comments */}
                <div>
                  <Label htmlFor={`${competency.id}-comments`} className={`text-sm font-medium mb-2 block ${commentsError ? 'text-destructive' : ''}`}>
                    Comments / Examples <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id={`${competency.id}-comments`}
                    value={rating?.comments || ''}
                    onChange={(e) => 
                      updateCompetencyComments(competency.id, competency.name, e.target.value)
                    }
                    placeholder="Provide specific examples that demonstrate this competency..."
                    className={`min-h-[80px] resize-y ${commentsError ? 'border-destructive' : ''}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Quantitative Rating */}
      <div className={`mt-8 pt-6 border-t border-border ${overallRatingError ? 'ring-2 ring-destructive/50 rounded-lg p-4' : ''}`}>
        <Label className={`text-base font-medium mb-4 block ${overallRatingError ? 'text-destructive' : ''}`}>
          Overall Performance Competencies Rating <span className="text-destructive">*</span>
        </Label>
        <RatingSelector
          value={data.overallQuantitativeRating}
          onChange={(rating) => onUpdate({ overallQuantitativeRating: rating as OverallRating })}
          options={RATING_OPTIONS}
        />
      </div>
    </div>
  );
};
