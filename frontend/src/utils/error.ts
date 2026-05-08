import type { ApiError, ValidationError } from '@/types/api';

/**
 * Extract human-readable error message from Axios error response.
 * FastAPI/Pydantic validation errors (422) have detail as an array.
 */
export function getErrorMessage(error: unknown): string {
  // Handle axios error with friendlyMessage (set by client interceptor)
  const withFriendly = error as Error & { friendlyMessage?: string };
  if (withFriendly.friendlyMessage) {
    return withFriendly.friendlyMessage;
  }

  const err = error as Error & { response?: { data?: ApiError } };
  const raw = err.response?.data?.detail;

  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return (raw as ValidationError[]).map((e) => {
      if (typeof e === 'string') return e;
      const loc = Array.isArray(e.loc) ? e.loc.join(' › ') : '';
      return loc ? `${loc}: ${e.msg}` : e.msg || String(e);
    }).join('；');
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as { msg?: string };
    return obj.msg || JSON.stringify(raw);
  }
  return err.message || '请求失败';
}

/**
 * Show error message from Axios error safely.
 * NOTE: Toast is now handled by the client interceptor — use this only
 * when you need to suppress the automatic toast (e.g., background requests).
 */
export function showError(error: unknown, fallback?: string): void {
  // Dynamically import antd to avoid coupling at module level
  import('antd').then(({ message }) => {
    message.error(getErrorMessage(error) || fallback || '请求失败');
  });
}
