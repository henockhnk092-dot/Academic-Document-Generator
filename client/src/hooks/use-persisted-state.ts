import { useState, useEffect } from 'react';

/**
 * Custom hook to persist state in localStorage
 * @param key - The localStorage key
 * @param defaultValue - Default value if nothing in localStorage
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  }, [key, state]);

  return [state, setState] as const;
}

/**
 * Hook to clear persisted state
 */
export function useClearPersistedState(key: string) {
  return () => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error clearing ${key} from localStorage:`, error);
    }
  };
}
