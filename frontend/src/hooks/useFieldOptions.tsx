import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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

  const refresh = useCallback(async () => {
    try {
      const data = await getFieldOptions();
      setOptions(data || []);
    } catch (e) {
      console.error('Failed to load field options:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
