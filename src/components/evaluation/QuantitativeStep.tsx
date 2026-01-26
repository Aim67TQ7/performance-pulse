import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EvaluationData, PerformanceObjective } from '@/types/evaluation';
import { Target, Trophy, Plus, Trash2 } from 'lucide-react';

interface QuantitativeStepProps {
  data: EvaluationData['quantitative'];
  onUpdate: (updates: Partial<EvaluationData['quantitative']>) => void;
  showErrors?: boolean;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const calculateScore = (actual: string, target: string): string => {
  // Extract numeric values from strings
  const actualNum = parseFloat(actual.replace(/[^0-9.-]/g, ''));
  const targetNum = parseFloat(target.replace(/[^0-9.-]/g, ''));
  
  if (isNaN(actualNum) || isNaN(targetNum) || targetNum === 0) {
    return '-';
  }
  
  const score = (actualNum / targetNum) * 100;
  return `${Math.round(score)}%`;
};

export const QuantitativeStep = ({ data, onUpdate, showErrors = false }: QuantitativeStepProps) => {
  // Ensure performanceObjectives is an array
  const objectives: PerformanceObjective[] = Array.isArray(data.performanceObjectives) 
    ? data.performanceObjectives 
    : [];

  // Validation helpers - only Performance Objective field is required
  const hasCompleteObjective = objectives.some(
    obj => obj.objective.trim()
  );
  const hasAccomplishments = !!data.workAccomplishments?.trim();
  
  const objectivesError = showErrors && !hasCompleteObjective;
  const accomplishmentsError = showErrors && !hasAccomplishments;

  const addObjective = () => {
    const newObjective: PerformanceObjective = {
      id: generateId(),
      objective: '',
      measurableTarget: '',
      actual: '',
    };
    onUpdate({ performanceObjectives: [...objectives, newObjective] });
  };

  const updateObjective = (id: string, field: keyof PerformanceObjective, value: string) => {
    const updated = objectives.map(obj => 
      obj.id === id ? { ...obj, [field]: value } : obj
    );
    onUpdate({ performanceObjectives: updated });
  };

  const removeObjective = (id: string) => {
    onUpdate({ performanceObjectives: objectives.filter(obj => obj.id !== id) });
  };

  return (
    <div className="form-section animate-slide-up">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
          Section II: Quantitative Self-Assessment
        </h2>
        <p className="text-muted-foreground">
          Describe your key achievements and objectives for this evaluation period.
        </p>
      </div>

      <div className="space-y-8">
        {/* Performance Objectives Table */}
        <div className={`space-y-4 ${objectivesError ? 'ring-2 ring-destructive/50 rounded-lg p-4 -m-4' : ''}`}>
          <div className="flex items-center justify-between">
            <Label className={`flex items-center gap-2 text-base font-medium ${objectivesError ? 'text-destructive' : ''}`}>
              <Target className={`w-5 h-5 ${objectivesError ? 'text-destructive' : 'text-primary'}`} />
              Performance Objectives
              <span className="text-destructive">*</span>
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addObjective}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Objective
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            List your key performance objectives, the measurable targets, and your actual results.
          </p>

          {/* Table Header */}
          <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_80px_40px] gap-3 text-sm font-medium text-muted-foreground border-b pb-2">
            <div>Performance Objective</div>
            <div>Measurable Target</div>
            <div>Actual</div>
            <div className="text-center">Score</div>
            <div></div>
          </div>

          {/* Objective Rows */}
          {objectives.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
              <p>No performance objectives added yet.</p>
              <Button
                type="button"
                variant="link"
                onClick={addObjective}
                className="mt-2"
              >
                Add your first objective
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {objectives.map((obj, index) => (
                <div key={obj.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_80px_40px] gap-3 p-3 bg-muted/30 rounded-lg">
                  {/* Mobile Labels */}
                  <div className="md:hidden text-xs font-medium text-muted-foreground mb-1">
                    Objective #{index + 1}
                  </div>
                  
                  {/* Objective */}
                  <div>
                    <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Performance Objective</Label>
                    <Textarea
                      value={obj.objective}
                      onChange={(e) => updateObjective(obj.id, 'objective', e.target.value)}
                      placeholder="e.g., On-Time Delivery Rate"
                      className="min-h-[60px] resize-y"
                    />
                  </div>
                  
                  {/* Measurable Target */}
                  <div>
                    <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Measurable Target</Label>
                    <Input
                      value={obj.measurableTarget}
                      onChange={(e) => updateObjective(obj.id, 'measurableTarget', e.target.value)}
                      placeholder="e.g., >93%"
                    />
                  </div>
                  
                  {/* Actual */}
                  <div>
                    <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Actual</Label>
                    <Input
                      value={obj.actual}
                      onChange={(e) => updateObjective(obj.id, 'actual', e.target.value)}
                      placeholder="e.g., 94%"
                    />
                  </div>
                  
                  {/* Calculated Score */}
                  <div className="flex items-center justify-center">
                    <Label className="md:hidden text-xs text-muted-foreground mr-2">Score:</Label>
                    <div className="font-semibold text-primary">
                      {calculateScore(obj.actual, obj.measurableTarget)}
                    </div>
                  </div>
                  
                  {/* Delete Button */}
                  <div className="flex items-center justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeObjective(obj.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Work Accomplishments */}
        <div className={`space-y-3 ${accomplishmentsError ? 'ring-2 ring-destructive/50 rounded-lg p-4 -m-4' : ''}`}>
          <Label htmlFor="accomplishments" className={`flex items-center gap-2 text-base font-medium ${accomplishmentsError ? 'text-destructive' : ''}`}>
            <Trophy className={`w-5 h-5 ${accomplishmentsError ? 'text-destructive' : 'text-warning'}`} />
            Work Accomplishments
            <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground">
            Describe your major work accomplishments and contributions during this period.
          </p>
          <Textarea
            id="accomplishments"
            value={data.workAccomplishments || ''}
            onChange={(e) => onUpdate({ workAccomplishments: e.target.value })}
            placeholder="• Successfully completed [project/initiative]&#10;• Improved [process/outcome] by [metric]&#10;• Led team to achieve [goal]"
            className={`min-h-[180px] resize-y ${accomplishmentsError ? 'border-destructive' : ''}`}
          />
          <p className="text-xs text-muted-foreground text-right">
            Aim for 3-5 bullet points
          </p>
        </div>
      </div>
    </div>
  );
};
