import { cn } from '@/lib/utils';
import { OverallRating, RATING_OPTIONS } from '@/types/evaluation';
import { Check } from 'lucide-react';

interface RatingSelectorProps {
  value: OverallRating | null;
  onChange: (value: OverallRating) => void;
  options?: typeof RATING_OPTIONS;
}

export const RatingSelector = ({ value, onChange, options = RATING_OPTIONS }: RatingSelectorProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {options.map((option) => {
        const isSelected = value === option.value;
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rating-button group",
              isSelected && "selected"
            )}
          >
            <div className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center mb-2 transition-all",
              isSelected 
                ? "border-primary bg-primary" 
                : "border-muted-foreground/30 group-hover:border-primary/50"
            )}>
              {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
            </div>
            <span className={cn(
              "text-sm font-medium text-center",
              isSelected ? "text-primary" : "text-foreground"
            )}>
              {option.label}
            </span>
            {option.score && (
              <span className={cn(
                "text-xs",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}>
                ({option.score})
              </span>
            )}
            <span className="text-xs text-muted-foreground text-center mt-1 hidden md:block">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
};
