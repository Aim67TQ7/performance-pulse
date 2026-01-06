import { useState, useCallback, useEffect } from 'react';
import { EvaluationData, ErrorLog } from '@/types/evaluation';
import { useErrorLogger } from './useErrorLogger';

const STORAGE_KEY = 'pep_evaluation_draft';

const getInitialData = (): EvaluationData => ({
  employeeInfo: {
    name: '',
    title: '',
    department: '',
    periodYear: new Date().getFullYear(),
  },
  quantitative: {
    performanceObjectives: '',
    workAccomplishments: '',
    personalDevelopment: '',
    quantitativeRating: null,
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
  const [data, setData] = useState<EvaluationData>(getInitialData);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { logError } = useErrorLogger();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData(parsed);
        if (parsed.lastSavedAt) {
          setLastSaved(new Date(parsed.lastSavedAt));
        }
      }
    } catch (error) {
      logError('save', 'Failed to load saved evaluation data', { error });
    }
  }, [logError]);

  // Auto-save to localStorage
  const saveToLocal = useCallback(async (newData: EvaluationData) => {
    setIsSaving(true);
    try {
      const saveData = {
        ...newData,
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      setLastSaved(new Date());
    } catch (error) {
      logError('save', 'Failed to save evaluation data locally', { error });
    } finally {
      setIsSaving(false);
    }
  }, [logError]);

  const updateEmployeeInfo = useCallback((updates: Partial<EvaluationData['employeeInfo']>) => {
    setData(prev => {
      const newData = {
        ...prev,
        employeeInfo: { ...prev.employeeInfo, ...updates },
      };
      saveToLocal(newData);
      return newData;
    });
  }, [saveToLocal]);

  const updateQuantitative = useCallback((updates: Partial<EvaluationData['quantitative']>) => {
    setData(prev => {
      const newData = {
        ...prev,
        quantitative: { ...prev.quantitative, ...updates },
      };
      saveToLocal(newData);
      return newData;
    });
  }, [saveToLocal]);

  const updateQualitative = useCallback((key: keyof EvaluationData['qualitative'], value: number | null) => {
    setData(prev => {
      const newData = {
        ...prev,
        qualitative: { ...prev.qualitative, [key]: value },
      };
      saveToLocal(newData);
      return newData;
    });
  }, [saveToLocal]);

  const updateSummary = useCallback((updates: Partial<EvaluationData['summary']>) => {
    setData(prev => {
      const newData = {
        ...prev,
        summary: { ...prev.summary, ...updates },
      };
      saveToLocal(newData);
      return newData;
    });
  }, [saveToLocal]);

  const submitEvaluation = useCallback(async () => {
    try {
      setData(prev => {
        const newData = {
          ...prev,
          status: 'submitted' as const,
          submittedAt: new Date(),
        };
        saveToLocal(newData);
        return newData;
      });
      return true;
    } catch (error) {
      logError('submit', 'Failed to submit evaluation', { error });
      return false;
    }
  }, [saveToLocal, logError]);

  const resetEvaluation = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setData(getInitialData());
    setLastSaved(null);
  }, []);

  const calculateProgress = useCallback(() => {
    const sections = {
      employeeInfo: Object.values(data.employeeInfo).filter(v => v && v !== '').length / 4,
      quantitative: (
        (data.quantitative.performanceObjectives ? 1 : 0) +
        (data.quantitative.workAccomplishments ? 1 : 0) +
        (data.quantitative.personalDevelopment ? 1 : 0) +
        (data.quantitative.quantitativeRating ? 1 : 0)
      ) / 4,
      qualitative: Object.values(data.qualitative).filter(v => v !== null).length / 15,
      summary: (
        (data.summary.employeeSummary ? 1 : 0) +
        (data.summary.targetsForNextYear ? 1 : 0) +
        (data.summary.qualitativeRating ? 1 : 0) +
        (data.summary.overallRating ? 1 : 0)
      ) / 4,
    };

    const total = (sections.employeeInfo + sections.quantitative + sections.qualitative + sections.summary) / 4;
    
    return { sections, total: Math.round(total * 100) };
  }, [data]);

  return {
    data,
    isSaving,
    lastSaved,
    updateEmployeeInfo,
    updateQuantitative,
    updateQualitative,
    updateSummary,
    submitEvaluation,
    resetEvaluation,
    calculateProgress,
  };
};
