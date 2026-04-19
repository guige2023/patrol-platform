import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { getFieldOptions, FieldOption } from '@/api/fieldOptions';

interface FieldOptionsContextValue {
  options: FieldOption[];
  loading: boolean;
  getOptions: (fieldKey: string) => { label: string; value: string }[];
  refresh: () => Promise<void>;
}

const FieldOptionsContext = createContext<FieldOptionsContextValue>({
  options: [],
  loading: true,
  getOptions: () => [],
  refresh: async () => {},
});

export const FieldOptionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<FieldOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenVersion, setTokenVersion] = useState(0);
  const refreshingRef = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for token changes (triggered by login)
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('token');
      if (token) {
        setTokenVersion(v => v + 1);
      }
    };

    window.addEventListener('storage', checkToken);
    const interval = setInterval(checkToken, 2000);
    return () => {
      window.removeEventListener('storage', checkToken);
      clearInterval(interval);
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    // Deduplicate concurrent refresh calls
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(true);
    try {
      const data = await getFieldOptions();
      setOptions(data || []);
    } catch (e) {
      console.error('Failed to load field options:', e);
    } finally {
      refreshingRef.current = false;
      setLoading(false);
      // Debounce next poll: don't re-fetch within 10s
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      cooldownRef.current = setTimeout(() => {
        if (localStorage.getItem('token')) refresh();
      }, 10000);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, tokenVersion]);

  const getOptions = useCallback((fieldKey: string): { label: string; value: string }[] => {
    const field = options.find(f => f.field_key === fieldKey);
    if (!field) return [];
    return field.options
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(o => ({ label: o.label, value: o.value }));
  }, [options]);

  return (
    <FieldOptionsContext.Provider value={{ options, loading, getOptions, refresh }}>
      {children}
    </FieldOptionsContext.Provider>
  );
};

export const useFieldOptions = () => useContext(FieldOptionsContext);
