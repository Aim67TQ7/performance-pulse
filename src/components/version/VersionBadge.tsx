import { useState } from 'react';
import { useAppVersion } from '@/hooks/useAppVersion';
import { RevisionHistoryDialog } from './RevisionHistoryDialog';

export const VersionBadge = () => {
  const [showHistory, setShowHistory] = useState(false);
  const { data, isLoading } = useAppVersion(true);

  if (isLoading || !data?.current) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowHistory(true)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        title="View revision history"
      >
        v{data.current.version}
      </button>
      
      <RevisionHistoryDialog
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        currentVersion={data.current}
        history={data.history || []}
      />
    </>
  );
};