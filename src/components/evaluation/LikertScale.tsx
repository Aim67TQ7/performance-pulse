import { cn } from '@/lib/utils';
import { LIKERT_SCALE } from '@/types/evaluation';
import { X } from 'lucide-react';

interface LikertScaleProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

export const LikertScale = ({ value, onChange }: LikertScaleProps) => {
  return (
    <div className="likert-scale">
      {LIKERT_SCALE.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "likert-option",
            value === item.value && "selected"
          )}
          title={item.description}
        >
          {item.value}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "likert-option",
          value === null && "border-muted-foreground/50 bg-muted/50"
        )}
        title="Not Applicable"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
