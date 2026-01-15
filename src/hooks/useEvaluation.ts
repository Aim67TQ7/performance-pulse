import { useState, useCallback, useEffect } from 'react';
import { EvaluationData } from '@/types/evaluation';
import { useErrorLogger } from './useErrorLogger';
import { supabase } from '@/integrations/supabase/client';
import { generateEvaluationPdf } from '@/lib/pdfGenerator';
import { useAuth } from '@/hooks/useAuth';

const STORAGE_KEY = 'pep_evaluation_draft';

interface Employee {
  id: string;
  name_first: string;
  name_last: string;
  job_title: string | null;
  department: string | null;
  reports_to: string;
  user_id: string | null;
}

// Hardcoded assessment year - do not change without HR approval
const ASSESSMENT_YEAR = 2025;

const getInitialData = (): EvaluationData => ({
  employeeInfo: {
    name: '',
    title: '',
    department: '',
    periodYear: ASSESSMENT_YEAR,
    supervisorId: '',
    supervisorName: '',
  },
  quantitative: {
    performanceObjectives: [],
    workAccomplishments: '',
    personalDevelopment: '',
    quantitativeRating: null,
    competencies: [],
    overallQuantitativeRating: null,
  },
  qualitative: {
    forecastingPlanningSkills: null,
    administrationSkills: null,
    leadership: null,
    safety: null,
    developingEmployees: null,
    communicationSkills: null,
    developingCooperationTeamwork: null,
    customerSatisfaction: null,
    peerRelationships: null,
    subordinateRelationships: null,
    jobKnowledgeKnowHow: null,
    qualityImage: null,
    attitude: null,
    decisionMaking: null,
    creativityInitiative: null,
  },
  summary: {
    employeeSummary: '',
    targetsForNextYear: '',
    qualitativeRating: null,
    overallRating: null,
  },
  status: 'draft',
});

export const useEvaluation = () => {
  const { employeeId: tokenEmployeeId, employee: authEmployee } = useAuth();
  const [data, setData] = useState<EvaluationData>(getInitialData);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const { logError } = useErrorLogger();

  // Load employee data and existing evaluation
  useEffect(() => {
    const loadData = async () => {
      if (!tokenEmployeeId || !authEmployee) {
        setIsLoading(false);
        return;
      }

      try {
        // Use hardcoded assessment year
        const periodYear = ASSESSMENT_YEAR;

        // Use employee data from AuthContext instead of fetching from DB
        // This avoids RLS issues since the data comes from JWT verification
        const employeeData: Employee = {
          id: authEmployee.id,
          name_first: authEmployee.name_first,
          name_last: authEmployee.name_last,
          job_title: authEmployee.job_title,
          department: authEmployee.department,
          reports_to: authEmployee.reports_to || '',
          user_id: null, // Not needed for evaluation
        };

        // Check if user is a salary employee
        if (authEmployee.benefit_class !== 'salary') {
          logError('validation', 'Only salaried employees can complete evaluations');
          setIsLoading(false);
          return;
        }

        setCurrentEmployee(employeeData);

        // Get manager info - this still needs a DB query, but managers are fewer
        // and RLS should allow reading public employee names
        let managerName = '';
        if (employeeData.reports_to) {
          try {
            const { data: managerData } = await supabase
              .from('employees')
              .select('id, name_first, name_last')
              .eq('id', employeeData.reports_to)
              .single();
            
            if (managerData) {
              managerName = `${managerData.name_first} ${managerData.name_last}`;
            }
          } catch {
            // If we can't get manager name, continue without it
            console.log('[PEP] Could not fetch manager name, continuing');
          }
        }

        // Check for existing evaluation
        const { data: evalData } = await supabase
          .from('pep_evaluations')
          .select('*')
          .eq('employee_id', employeeData.id)
          .eq('period_year', periodYear)
          .single();

        if (evalData) {
          // Load existing evaluation
          const loadedData: EvaluationData = {
            id: evalData.id,
            employeeId: evalData.employee_id,
            employeeInfo: (evalData.employee_info_json as unknown as EvaluationData['employeeInfo']) || {
              name: `${employeeData.name_first} ${employeeData.name_last}`,
              title: employeeData.job_title || '',
              department: employeeData.department || '',
              periodYear: periodYear,
              supervisorId: employeeData.reports_to,
              supervisorName: managerName,
            },
            quantitative: (evalData.quantitative_json as unknown as EvaluationData['quantitative']) || getInitialData().quantitative,
            qualitative: (evalData.qualitative_json as unknown as EvaluationData['qualitative']) || getInitialData().qualitative,
            summary: (evalData.summary_json as unknown as EvaluationData['summary']) || getInitialData().summary,
            status: evalData.status as EvaluationData['status'],
            lastSavedAt: evalData.updated_at ? new Date(evalData.updated_at) : undefined,
            submittedAt: evalData.submitted_at ? new Date(evalData.submitted_at) : undefined,
            pdfUrl: evalData.pdf_url || undefined,
            pdfGeneratedAt: evalData.pdf_generated_at ? new Date(evalData.pdf_generated_at) : undefined,
            reopenedAt: evalData.reopened_at ? new Date(evalData.reopened_at) : undefined,
            reopenedBy: evalData.reopened_by || undefined,
            reopenReason: evalData.reopen_reason || undefined,
          };
          
          setData(loadedData);
          setIsReadOnly(evalData.status === 'submitted' || evalData.status === 'reviewed' || evalData.status === 'signed');
          setLastSaved(evalData.updated_at ? new Date(evalData.updated_at) : null);
        } else {
          // Create new evaluation with employee info pre-populated
          const newData = getInitialData();
          newData.employeeInfo = {
            name: `${employeeData.name_first} ${employeeData.name_last}`,
            title: employeeData.job_title || '',
            department: employeeData.department || '',
            periodYear: periodYear,
            supervisorId: employeeData.reports_to,
            supervisorName: managerName,
          };
          newData.employeeId = employeeData.id;
          setData(newData);
        }
      } catch (error) {
        logError('network', 'Failed to load evaluation data', { error });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [tokenEmployeeId, logError]);

  // Save to Supabase
  const saveToDatabase = useCallback(async (newData: EvaluationData) => {
    if (isReadOnly || isLoading) return;
    
    // Wait for employee data to load before attempting to save
    if (!currentEmployee) {
      // Silently save to localStorage while employee data loads
      const saveData = {
        ...newData,
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      return;
    }
    
    setIsSaving(true);
    try {
      const evalPayload = {
        employee_id: currentEmployee.id,
        period_year: newData.employeeInfo.periodYear,
        status: newData.status,
        employee_info_json: JSON.parse(JSON.stringify(newData.employeeInfo)),
        quantitative_json: JSON.parse(JSON.stringify(newData.quantitative)),
        qualitative_json: JSON.parse(JSON.stringify(newData.qualitative)),
        summary_json: JSON.parse(JSON.stringify(newData.summary)),
      };

      if (newData.id) {
        // Update existing
        const { error } = await supabase
          .from('pep_evaluations')
          .update(evalPayload)
          .eq('id', newData.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data: insertedData, error } = await supabase
          .from('pep_evaluations')
          .insert(evalPayload)
          .select('id')
          .single();

        if (error) throw error;
        
        setData(prev => ({ ...prev, id: insertedData.id }));
      }
      
      setLastSaved(new Date());
    } catch (error) {
      // Log error silently without showing toast for auto-save failures
      console.error('[PEP] Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [currentEmployee, isReadOnly, isLoading]);

  // Sync employee info changes to the employees table
  const syncEmployeeToDatabase = useCallback(async (updates: Partial<EvaluationData['employeeInfo']>) => {
    if (!currentEmployee) return;

    try {
      const employeeUpdates: Record<string, string | null> = {};
      
      // Map employeeInfo fields to employees table columns
      if (updates.name !== undefined) {
        const nameParts = updates.name.trim().split(/\s+/);
        employeeUpdates.name_first = nameParts[0] || '';
        employeeUpdates.name_last = nameParts.slice(1).join(' ') || '';
      }
      if (updates.title !== undefined) {
        employeeUpdates.job_title = updates.title || null;
      }
      if (updates.department !== undefined) {
        employeeUpdates.department = updates.department || null;
      }

      // Only update if there are changes to sync
      if (Object.keys(employeeUpdates).length > 0) {
        const { error } = await supabase
          .from('employees')
          .update(employeeUpdates)
          .eq('id', currentEmployee.id);

        if (error) {
          logError('save', 'Failed to update employee record', { error });
        }
      }
    } catch (error) {
      logError('save', 'Failed to sync employee data', { error });
    }
  }, [currentEmployee, logError]);

  const updateEmployeeInfo = useCallback((updates: Partial<EvaluationData['employeeInfo']>) => {
    if (isReadOnly) return;
    setData(prev => {
      const newData = {
        ...prev,
        employeeInfo: { ...prev.employeeInfo, ...updates },
      };
      saveToDatabase(newData);
      
      // Also sync name, title, department changes to employees table
      if ('name' in updates || 'title' in updates || 'department' in updates) {
        syncEmployeeToDatabase(updates);
      }
      
      return newData;
    });
  }, [saveToDatabase, syncEmployeeToDatabase, isReadOnly]);

  const updateQuantitative = useCallback((updates: Partial<EvaluationData['quantitative']>) => {
    if (isReadOnly) return;
    setData(prev => {
      const newData = {
        ...prev,
        quantitative: { ...prev.quantitative, ...updates },
      };
      saveToDatabase(newData);
      return newData;
    });
  }, [saveToDatabase, isReadOnly]);

  const updateQualitative = useCallback((key: keyof EvaluationData['qualitative'], value: number | null) => {
    if (isReadOnly) return;
    setData(prev => {
      const newData = {
        ...prev,
        qualitative: { ...prev.qualitative, [key]: value },
      };
      saveToDatabase(newData);
      return newData;
    });
  }, [saveToDatabase, isReadOnly]);

  const updateSummary = useCallback((updates: Partial<EvaluationData['summary']>) => {
    if (isReadOnly) return;
    setData(prev => {
      const newData = {
        ...prev,
        summary: { ...prev.summary, ...updates },
      };
      saveToDatabase(newData);
      return newData;
    });
  }, [saveToDatabase, isReadOnly]);

  const submitEvaluation = useCallback(async (): Promise<{ success: boolean; pdfUrl?: string }> => {
    try {
      if (!currentEmployee) {
        logError('submit', 'Cannot submit: employee data not loaded');
        return { success: false };
      }

      let evaluationId = data.id;

      // If no evaluation ID exists, create the record first
      if (!evaluationId) {
        const evalPayload = {
          employee_id: currentEmployee.id,
          period_year: data.employeeInfo.periodYear,
          status: 'draft',
          employee_info_json: JSON.parse(JSON.stringify(data.employeeInfo)),
          quantitative_json: JSON.parse(JSON.stringify(data.quantitative)),
          qualitative_json: JSON.parse(JSON.stringify(data.qualitative)),
          summary_json: JSON.parse(JSON.stringify(data.summary)),
        };

        const { data: insertedData, error: insertError } = await supabase
          .from('pep_evaluations')
          .insert(evalPayload)
          .select('id')
          .single();

        if (insertError) {
          logError('submit', 'Failed to create evaluation record', { error: insertError });
          return { success: false };
        }

        evaluationId = insertedData.id;
        setData(prev => ({ ...prev, id: evaluationId }));
      }

      // Check if a PDF already exists for this evaluation - skip regeneration if so
      let remotePdfUrl: string | undefined;
      
      const { data: existingEval } = await supabase
        .from('pep_evaluations')
        .select('pdf_url')
        .eq('id', evaluationId)
        .single();
      
      if (existingEval?.pdf_url && /^https?:\/\//.test(existingEval.pdf_url)) {
        // PDF already exists - reuse it
        remotePdfUrl = existingEval.pdf_url;
        console.log('[PEP] Reusing existing PDF', { pdf_url: remotePdfUrl });
      } else {
        // Generate PDF (while evaluation is still in a draft/reopened state so RLS allows updating pdf_url)
        // Important: only persist *remote* URLs (never store blob: URLs in the DB)
        try {
          const pdfUrl = await generateEvaluationPdf({ ...data, id: evaluationId });
          remotePdfUrl = pdfUrl && /^https?:\/\//.test(pdfUrl) ? pdfUrl : undefined;
        } catch (pdfError) {
          logError('submit', 'PDF generation failed, but evaluation will still be submitted', { error: pdfError });
        }
      }

      // Update status to submitted (include pdf_url only if it successfully uploaded to Storage)
      const { error: updateError } = await supabase
        .from('pep_evaluations')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          pdf_url: remotePdfUrl,
          employee_info_json: JSON.parse(JSON.stringify(data.employeeInfo)),
          quantitative_json: JSON.parse(JSON.stringify(data.quantitative)),
          qualitative_json: JSON.parse(JSON.stringify(data.qualitative)),
          summary_json: JSON.parse(JSON.stringify(data.summary)),
        })
        .eq('id', evaluationId);

      if (updateError) throw updateError;

      setData(prev => ({
        ...prev,
        id: evaluationId,
        status: 'submitted',
        submittedAt: new Date(),
        pdfUrl: remotePdfUrl ?? prev.pdfUrl,
      }));
      setIsReadOnly(true);
      
      return { success: true, pdfUrl: remotePdfUrl };
    } catch (error) {
      logError('submit', 'Failed to submit evaluation', { error });
      return { success: false };
    }
  }, [data, currentEmployee, logError]);

  const reopenEvaluation = useCallback(async (reason: string) => {
    try {
      if (!data.id || !tokenEmployeeId) return false;

      // Get the manager's employee record (the person reopening)
      const { data: managerEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('id', tokenEmployeeId)
        .single();

      if (!managerEmployee) return false;

      const { error } = await supabase
        .from('pep_evaluations')
        .update({
          status: 'reopened',
          reopened_at: new Date().toISOString(),
          reopened_by: managerEmployee.id,
          reopen_reason: reason,
        })
        .eq('id', data.id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        status: 'reopened',
        reopenedAt: new Date(),
        reopenedBy: managerEmployee.id,
        reopenReason: reason,
      }));
      setIsReadOnly(false);
      
      return true;
    } catch (error) {
      logError('save', 'Failed to reopen evaluation', { error });
      return false;
    }
  }, [data.id, tokenEmployeeId, logError]);

  const resetEvaluation = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setData(getInitialData());
    setLastSaved(null);
    setIsReadOnly(false);
  }, []);

  const calculateProgress = useCallback(() => {
    const sections = {
      employeeInfo: Object.values(data.employeeInfo).filter(v => v && v !== '').length / 5,
      quantitative: (
        // Performance objectives + work accomplishments
        (data.quantitative.performanceObjectives?.length > 0 ? 0.5 : 0) +
        (data.quantitative.workAccomplishments ? 0.5 : 0)
      ),
      competencies: (
        // Count completed competencies + overall rating
        ((data.quantitative.competencies?.filter(c => c.score !== null).length || 0) / Math.max(data.quantitative.competencies?.length || 1, 1)) * 0.8 +
        (data.quantitative.overallQuantitativeRating ? 0.2 : 0)
      ),
      summary: (
        (data.summary.employeeSummary ? 0.5 : 0) +
        (data.summary.overallRating ? 0.5 : 0)
      ),
    };

    const total = (sections.employeeInfo + sections.quantitative + sections.competencies + sections.summary) / 4;
    
    return { sections, total: Math.round(total * 100) };
  }, [data]);

  return {
    data,
    isSaving,
    lastSaved,
    isLoading,
    isReadOnly,
    currentEmployee,
    isManager,
    updateEmployeeInfo,
    updateQuantitative,
    updateQualitative,
    updateSummary,
    submitEvaluation,
    reopenEvaluation,
    resetEvaluation,
    calculateProgress,
  };
};
