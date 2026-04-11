import { useState, useCallback } from 'react';

export function useSearch<T>(fetchFn: (params: T) => Promise<any>) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (params: T) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(params);
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  return { loading, data, error, search };
}