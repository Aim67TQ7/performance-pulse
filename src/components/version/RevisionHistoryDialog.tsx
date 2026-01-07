import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import type { AppRevision } from '@/hooks/useAppVersion';

interface RevisionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: AppRevision | null;
  history: AppRevision[];
}

const getRevisionTypeColor = (type: string) => {
  switch (type) {
    case 'MAJOR':
      return 'bg-destructive text-destructive-foreground';
    case 'MINOR':
      return 'bg-primary text-primary-foreground';
    case 'PATCH':
      return 'bg-secondary text-secondary-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const RevisionHistoryDialog = ({
  isOpen,
  onClose,
  currentVersion,
  history,
}: RevisionHistoryDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Revision History
            {currentVersion && (
              <Badge variant="outline" className="font-mono">
                v{currentVersion.version}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {history.map((revision, index) => (
              <div 
                key={revision.version}
                className={`p-3 rounded-lg border ${
                  index === 0 ? 'border-primary/50 bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">
                      v{revision.version}
                    </span>
                    <Badge 
                      className={`text-xs ${getRevisionTypeColor(revision.revision_type)}`}
                    >
                      {revision.revision_type}
                    </Badge>
                    {index === 0 && (
                      <Badge variant="outline" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(revision.release_date), 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {revision.description}
                </p>
              </div>
            ))}
            
            {history.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No revision history available.
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};