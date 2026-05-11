import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export function usePersistedState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error: any) {
      const isQuota =
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" ||
          error.name === "NS_ERROR_DOM_QUOTA_REACHED");
      if (isQuota) {
        toast({
          title: "Storage full",
          description: "Your browser storage is full. Clear some space or old documents to continue saving progress.",
          variant: "destructive",
          duration: 8000,
        });
      } else {
        console.error(`Error saving ${key} to localStorage:`, error);
      }
    }
  }, [key, state]);

  return [state, setState] as const;
}

export function useClearPersistedState(key: string) {
  return () => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error clearing ${key} from localStorage:`, error);
    }
  };
}
