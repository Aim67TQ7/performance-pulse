import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { AlertTriangle, CheckCircle, Trash2, X } from 'lucide-react';
import { ErrorLog } from '@/types/evaluation';
import { cn } from '@/lib/utils';

interface ErrorLogPanelProps {
  errors: ErrorLog[];
  onResolve: (errorId: string) => void;
  onClear: () => void;
}

export const ErrorLogPanel = ({ errors, onResolve, onClear }: ErrorLogPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const unresolvedCount = errors.filter(e => !e.resolved).length;

  const getTypeColor = (type: ErrorLog['type']) => {
    switch (type) {
      case 'validation':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'save':
        return 'bg-primary/10 text-primary border-primary/30';
      case 'submit':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'network':
        return 'bg-accent/10 text-accent border-accent/30';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative",
            unresolvedCount > 0 && "text-destructive hover:text-destructive"
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          {unresolvedCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              {unresolvedCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Error Log
          </SheetTitle>
          <SheetDescription>
            Review and manage errors that occurred during your session.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {errors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
              <p>No errors logged</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {errors.length} error{errors.length !== 1 ? 's' : ''} logged
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {errors.slice().reverse().map((error) => (
                  <div
                    key={error.id}
                    className={cn(
                      "p-3 rounded-lg border transition-opacity",
                      error.resolved ? "opacity-50" : "",
                      getTypeColor(error.type)
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {error.type}
                          </Badge>
                          {error.resolved && (
                            <Badge variant="secondary" className="text-xs">
                              Resolved
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{error.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(error.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {!error.resolved && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onResolve(error.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
