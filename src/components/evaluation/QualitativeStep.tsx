import { EvaluationData, QUALITATIVE_FACTORS, LIKERT_SCALE, QualitativeFactors } from '@/types/evaluation';
import { LikertScale } from './LikertScale';
import { Users, UserCheck, User } from 'lucide-react';

interface QualitativeStepProps {
  data: EvaluationData['qualitative'];
  onUpdate: (key: keyof QualitativeFactors, value: number | null) => void;
}

export const QualitativeStep = ({ data, onUpdate }: QualitativeStepProps) => {
  const sections = [
    {
      title: 'Planning & Organization',
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      factors: QUALITATIVE_FACTORS.planningOrganization,
    },
    {
      title: 'Interpersonal',
      icon: UserCheck,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      factors: QUALITATIVE_FACTORS.interpersonal,
    },
    {
      title: 'Individual',
      icon: User,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      factors: QUALITATIVE_FACTORS.individual,
    },
  ];

  return (
    <div className="form-section animate-slide-up">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
          B. Qualitative Self-Evaluation
        </h2>
        <p className="text-muted-foreground">
          Rate yourself on each performance factor from 1 (Unacceptable) to 5 (Exceptional).
        </p>
      </div>

      {/* Legend */}
      <div className="mb-8 p-4 bg-secondary/50 rounded-lg">
        <p className="text-sm font-medium mb-2">Rating Scale</p>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {LIKERT_SCALE.map((item) => (
            <span key={item.value} className="flex items-center gap-1">
              <span className="font-semibold text-foreground">{item.value}</span> = {item.description}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.title} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${section.bgColor}`}>
                <section.icon className={`w-5 h-5 ${section.color}`} />
              </div>
              <h3 className="text-lg font-semibold">{section.title}</h3>
            </div>

            <div className="space-y-4 pl-4 border-l-2 border-border">
              {section.factors.map((factor) => (
                <div
                  key={factor.key}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 px-4 rounded-lg hover:bg-secondary/30 transition-colors"
                >
                  <span className="text-sm font-medium flex-1">{factor.label}</span>
                  <LikertScale
                    value={data[factor.key as keyof QualitativeFactors]}
                    onChange={(value) => onUpdate(factor.key as keyof QualitativeFactors, value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
