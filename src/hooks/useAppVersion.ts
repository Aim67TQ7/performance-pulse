import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// This app's ID in the app_items table
const SELF_EVALUATION_APP_ID = '02ca319b-a7d0-4a5e-a8b6-b3b2df294072';

interface AppRevision {
  version: string;
  revision_type: 'MAJOR' | 'MINOR' | 'PATCH';
  description: string;
  release_date: string;
}

interface VersionResponse {
  current: AppRevision | null;
  history: AppRevision[] | null;
}

export const useAppVersion = (includeHistory = false) => {
  return useQuery({
    queryKey: ['app-version', SELF_EVALUATION_APP_ID, includeHistory],
    queryFn: async (): Promise<VersionResponse> => {
      // Get current version
      const { data: current, error: currentError } = await supabase
        .from('app_revisions')
        .select('version, revision_type, description, release_date')
        .eq('app_id', SELF_EVALUATION_APP_ID)
        .eq('is_current', true)
        .single();

      if (currentError && currentError.code !== 'PGRST116') {
        console.error('[useAppVersion] Error fetching current:', currentError);
        throw currentError;
      }

      let history: AppRevision[] | null = null;

      if (includeHistory) {
        const { data: historyData, error: historyError } = await supabase
          .from('app_revisions')
          .select('version, revision_type, description, release_date')
          .eq('app_id', SELF_EVALUATION_APP_ID)
          .order('release_date', { ascending: false });

        if (historyError) {
          console.error('[useAppVersion] Error fetching history:', historyError);
          throw historyError;
        }
        
        history = historyData as AppRevision[];
      }

      return { 
        current: current as AppRevision | null, 
        history 
      };
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
  });
};

export type { AppRevision, VersionResponse };