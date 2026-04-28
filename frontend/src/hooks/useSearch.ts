import { useState, useCallback } from 'react';

export function useSearch<T, R = unknown>(fetchFn: (params: T) => Promise<R>) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (params: T) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(params);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  return { loading, data, error, search };
}
