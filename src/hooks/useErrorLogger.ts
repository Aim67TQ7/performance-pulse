import { useState, useCallback } from 'react';
import { ErrorLog } from '@/types/evaluation';
import { toast } from 'sonner';

const ERROR_LOG_KEY = 'pep_error_logs';
const MAX_LOGS = 100;

export const useErrorLogger = () => {
  const [errors, setErrors] = useState<ErrorLog[]>(() => {
    try {
      const saved = localStorage.getItem(ERROR_LOG_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveErrors = useCallback((logs: ErrorLog[]) => {
    try {
      // Keep only the last MAX_LOGS entries
      const trimmed = logs.slice(-MAX_LOGS);
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(trimmed));
      setErrors(trimmed);
    } catch (error) {
      console.error('Failed to save error logs:', error);
    }
  }, []);

  const logError = useCallback((
    type: ErrorLog['type'],
    message: string,
    context?: Record<string, unknown>,
    showToast = true
  ) => {
    const newError: ErrorLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      message,
      context,
      resolved: false,
    };

    console.error(`[PEP Error - ${type}]`, message, context);

    setErrors(prev => {
      const updated = [...prev, newError];
      saveErrors(updated);
      return updated;
    });

    if (showToast) {
      toast.error(message, {
        description: 'This error has been logged for review.',
        duration: 5000,
      });
    }

    return newError.id;
  }, [saveErrors]);

  const resolveError = useCallback((errorId: string) => {
    setErrors(prev => {
      const updated = prev.map(e => 
        e.id === errorId ? { ...e, resolved: true } : e
      );
      saveErrors(updated);
      return updated;
    });
  }, [saveErrors]);

  const clearErrors = useCallback(() => {
    localStorage.removeItem(ERROR_LOG_KEY);
    setErrors([]);
  }, []);

  const getUnresolvedErrors = useCallback(() => {
    return errors.filter(e => !e.resolved);
  }, [errors]);

  const getErrorsByType = useCallback((type: ErrorLog['type']) => {
    return errors.filter(e => e.type === type);
  }, [errors]);

  return {
    errors,
    logError,
    resolveError,
    clearErrors,
    getUnresolvedErrors,
    getErrorsByType,
  };
};
