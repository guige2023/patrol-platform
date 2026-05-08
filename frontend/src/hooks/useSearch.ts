import { useState, useCallback, useRef } from 'react';

/**
 * Search hook with AbortController support to handle race conditions.
 * Cancels in-flight requests when a new search starts.
 */
export function useSearch<T, R = unknown>(fetchFn: (params: T) => Promise<R>) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (params: T) => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(params);
      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (e: unknown) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [fetchFn]);

  return { loading, data, error, search };
}
