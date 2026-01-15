import { useState, useCallback, useEffect, useRef } from 'react';
import { EvaluationData, ValidationError, ValidationResult } from '@/types/evaluation';
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
  
  // Ref to track latest data for beforeunload handler
  const dataRef = useRef<EvaluationData>(data);
  const currentEmployeeRef = useRef<Employee | null>(null);
  
  // Keep refs in sync
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  
  useEffect(() => {
    currentEmployeeRef.current = currentEmployee;
  }, [currentEmployee]);

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

        // Get supervisor name directly from auth context (populated by edge function)
        const managerName = authEmployee.supervisor_name || '';

        // Check for existing evaluation via edge function (bypasses RLS)
        const token = localStorage.getItem('pep_auth_token');
        const supabaseUrl = "https://qzwxisdfwswsrbzvpzlo.supabase.co";
        
        let evalData = null;
        let evalError = null;
        
        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/submit-evaluation/fetch?period_year=${periodYear}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (response.ok) {
            const result = await response.json();
            evalData = result.evaluation;
          } else {
            evalError = await response.json();
          }
        } catch (err) {
          console.error('[PEP] Failed to fetch evaluation:', err);
          evalError = err;
        }

        // Also check localStorage for any unsaved changes
        let localData: EvaluationData | null = null;
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            // Only use localStorage data if it matches the current employee
            if (parsed.employeeId === employeeData.id) {
              localData = parsed;
              console.log('[PEP] Found localStorage data for this employee');
            }
          }
        } catch {
          console.log('[PEP] Could not parse localStorage data');
        }

        if (evalData) {
          // Load existing evaluation from DB
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
          
          // Check if localStorage has newer data (compare timestamps)
          if (localData?.lastSavedAt && loadedData.lastSavedAt) {
            const localTime = new Date(localData.lastSavedAt).getTime();
            const dbTime = new Date(loadedData.lastSavedAt).getTime();
            if (localTime > dbTime && evalData.status !== 'submitted') {
              console.log('[PEP] Using newer localStorage data over DB data');
              // Merge localStorage data but keep the DB id
              setData({ ...localData, id: evalData.id });
              setLastSaved(new Date(localData.lastSavedAt));
              setIsReadOnly(false);
              return;
            }
          }
          
          setData(loadedData);
          setIsReadOnly(evalData.status === 'submitted' || evalData.status === 'reviewed' || evalData.status === 'signed');
          setLastSaved(evalData.updated_at ? new Date(evalData.updated_at) : null);
          
          // Clear localStorage if DB data is current
          localStorage.removeItem(STORAGE_KEY);
        } else if (localData && !evalError) {
          // No DB record but we have localStorage data - use it
          console.log('[PEP] Using localStorage data (no DB record)');
          setData(localData);
          if (localData.lastSavedAt) {
            setLastSaved(new Date(localData.lastSavedAt));
          }
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
  }, [tokenEmployeeId, authEmployee, logError]);

  // Save to localStorage helper (always available, no async)
  const saveToLocalStorage = useCallback((newData: EvaluationData) => {
    try {
      const saveData = {
        ...newData,
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      console.log('[PEP] Saved to localStorage');
    } catch (error) {
      console.error('[PEP] localStorage save failed:', error);
    }
  }, []);

  // Save on page unload/close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentData = dataRef.current;
      const employee = currentEmployeeRef.current;
      
      // Always save to localStorage before leaving
      if (currentData && currentData.status !== 'submitted') {
        saveToLocalStorage(currentData);
        
        // Attempt sync save to DB using sendBeacon if we have employee data
        if (employee && currentData.id) {
          const payload = {
            employee_id: employee.id,
            period_year: currentData.employeeInfo.periodYear,
            status: currentData.status,
            employee_info_json: currentData.employeeInfo,
            quantitative_json: currentData.quantitative,
            qualitative_json: currentData.qualitative,
            summary_json: currentData.summary,
          };
          
          // Use sendBeacon for reliable saves on page close
          const url = `https://qzwxisdfwswsrbzvpzlo.supabase.co/rest/v1/pep_evaluations?id=eq.${currentData.id}`;
          navigator.sendBeacon?.(url, JSON.stringify(payload));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveToLocalStorage]);

  // Get auth token from localStorage (custom auth)
  const getAuthToken = useCallback(() => {
    try {
      // Matches AuthContext storage keys
      return (
        localStorage.getItem('pep_auth_token') ||
        localStorage.getItem('pep_temp_token') ||
        null
      );
    } catch {
      console.error('[PEP] Could not get auth token');
      return null;
    }
  }, []);

  // Save to Supabase via edge function (bypasses RLS)
  const saveToDatabase = useCallback(async (newData: EvaluationData) => {
    if (isReadOnly || isLoading) return;
    
    // Always save to localStorage as backup first
    saveToLocalStorage(newData);
    
    // Wait for employee data to load before attempting DB save
    if (!currentEmployee) {
      console.log('[PEP] Employee not loaded yet, saved to localStorage only');
      return;
    }

    const authToken = getAuthToken();
    if (!authToken) {
      console.log('[PEP] No auth token, saved to localStorage only');
      return;
    }
    
    setIsSaving(true);
    try {
      const evalPayload = {
        evaluation_id: newData.id || null,
        period_year: newData.employeeInfo.periodYear,
        status: newData.status,
        employee_info_json: JSON.parse(JSON.stringify(newData.employeeInfo)),
        quantitative_json: JSON.parse(JSON.stringify(newData.quantitative)),
        qualitative_json: JSON.parse(JSON.stringify(newData.qualitative)),
        summary_json: JSON.parse(JSON.stringify(newData.summary)),
      };

      const response = await fetch(
        `https://qzwxisdfwswsrbzvpzlo.supabase.co/functions/v1/submit-evaluation/save`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify(evalPayload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save');
      }

      // If this was a new evaluation, update with the returned ID
      if (!newData.id && result.id) {
        setData(prev => ({ ...prev, id: result.id }));
        saveToLocalStorage({ ...newData, id: result.id });
      }
      
      setLastSaved(new Date());
      console.log('[PEP] Saved to database via edge function');
    } catch (error) {
      // Log error silently without showing toast for auto-save failures
      console.error('[PEP] Auto-save to DB failed, data preserved in localStorage:', error);
    } finally {
      setIsSaving(false);
    }
  }, [currentEmployee, isReadOnly, isLoading, saveToLocalStorage, getAuthToken]);

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

      const authToken = getAuthToken();
      if (!authToken) {
        logError('submit', 'Cannot submit: not authenticated');
        return { success: false };
      }

      let evaluationId = data.id;

      // If no evaluation ID exists, create the record first via edge function
      if (!evaluationId) {
        const evalPayload = {
          period_year: data.employeeInfo.periodYear,
          status: 'draft',
          employee_info_json: JSON.parse(JSON.stringify(data.employeeInfo)),
          quantitative_json: JSON.parse(JSON.stringify(data.quantitative)),
          qualitative_json: JSON.parse(JSON.stringify(data.qualitative)),
          summary_json: JSON.parse(JSON.stringify(data.summary)),
        };

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-evaluation/save`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(evalPayload),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          logError('submit', 'Failed to create evaluation record', { error: result.error });
          return { success: false };
        }

        evaluationId = result.id;
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
        // Generate PDF (while evaluation is still in a draft/reopened state)
        try {
          const pdfUrl = await generateEvaluationPdf({ ...data, id: evaluationId });
          remotePdfUrl = pdfUrl && /^https?:\/\//.test(pdfUrl) ? pdfUrl : undefined;
        } catch (pdfError) {
          logError('submit', 'PDF generation failed, but evaluation will still be submitted', { error: pdfError });
        }
      }

      // Submit via edge function (bypasses RLS)
      const submitResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-evaluation/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            evaluation_id: evaluationId,
            pdf_url: remotePdfUrl,
            employee_info_json: JSON.parse(JSON.stringify(data.employeeInfo)),
            quantitative_json: JSON.parse(JSON.stringify(data.quantitative)),
            qualitative_json: JSON.parse(JSON.stringify(data.qualitative)),
            summary_json: JSON.parse(JSON.stringify(data.summary)),
          }),
        }
      );

      const submitResult = await submitResponse.json();

      if (!submitResponse.ok) {
        throw new Error(submitResult.error || 'Failed to submit');
      }

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
  }, [data, currentEmployee, logError, getAuthToken]);

  const reopenEvaluation = useCallback(async (reason: string) => {
    try {
      if (!data.id) return false;

      const authToken = getAuthToken();
      if (!authToken) {
        logError('save', 'Cannot reopen: not authenticated');
        return false;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-evaluation/reopen`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            evaluation_id: data.id,
            reason,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reopen');
      }

      setData(prev => ({
        ...prev,
        status: 'reopened',
        reopenedAt: new Date(),
        reopenedBy: tokenEmployeeId || '',
        reopenReason: reason,
      }));
      setIsReadOnly(false);
      
      return true;
    } catch (error) {
      logError('save', 'Failed to reopen evaluation', { error });
      return false;
    }
  }, [data.id, tokenEmployeeId, logError, getAuthToken]);

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

  // Validate all required fields before submission
  const validateForSubmission = useCallback((): ValidationResult => {
    const errors: ValidationError[] = [];

    // Section II: Quantitative
    // Check for at least one complete objective
    const objectives = data.quantitative.performanceObjectives || [];
    const hasCompleteObjective = objectives.some(
      obj => obj.objective.trim() && obj.measurableTarget.trim() && obj.actual.trim()
    );
    if (!hasCompleteObjective) {
      errors.push({
        step: 2,
        stepName: 'Quantitative',
        field: 'performanceObjectives',
        message: 'Add at least one complete Performance Objective (all 3 fields required)',
      });
    }

    // Work accomplishments required
    if (!data.quantitative.workAccomplishments?.trim()) {
      errors.push({
        step: 2,
        stepName: 'Quantitative',
        field: 'workAccomplishments',
        message: 'Work Accomplishments is required',
      });
    }

    // Section III: Competencies
    const competencies = data.quantitative.competencies || [];
    for (const comp of competencies) {
      if (comp.score === null || comp.score === undefined) {
        errors.push({
          step: 3,
          stepName: 'Competencies',
          field: `competency_${comp.competencyId}_score`,
          message: `Please select a rating for "${comp.competencyName}"`,
        });
      }
      if (!comp.comments?.trim()) {
        errors.push({
          step: 3,
          stepName: 'Competencies',
          field: `competency_${comp.competencyId}_comments`,
          message: `Please add comments for "${comp.competencyName}"`,
        });
      }
    }

    // Overall competencies rating required
    if (!data.quantitative.overallQuantitativeRating) {
      errors.push({
        step: 3,
        stepName: 'Competencies',
        field: 'overallQuantitativeRating',
        message: 'Overall Performance Competencies Rating is required',
      });
    }

    // Section IV: Summary
    if (!data.summary.employeeSummary?.trim()) {
      errors.push({
        step: 4,
        stepName: 'Summary',
        field: 'employeeSummary',
        message: 'Employee Summary is required',
      });
    }

    if (!data.summary.overallRating) {
      errors.push({
        step: 4,
        stepName: 'Summary',
        field: 'overallRating',
        message: 'Overall Self-Evaluation Rating is required',
      });
    }

    // Determine first incomplete step
    const firstIncompleteStep = errors.length > 0 ? errors[0].step : null;

    return {
      isValid: errors.length === 0,
      errors,
      firstIncompleteStep,
    };
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
    validateForSubmission,
  };
};
