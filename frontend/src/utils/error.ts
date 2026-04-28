import { message } from 'antd';
import type { ApiError, ValidationError } from '@/types/api';

/**
 * Extract human-readable error message from Axios error response.
 * FastAPI/Pydantic validation errors (422) have detail as an array.
 */
export function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return '请求失败';
  
  // Try to extract from response data
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
  return error.message || '请求失败';
}

/**
 * Show error message from Axios error safely (handles array details).
 */
export function showError(error: unknown, fallback?: string): void {
  message.error(getErrorMessage(error) || fallback || '请求失败');
}
