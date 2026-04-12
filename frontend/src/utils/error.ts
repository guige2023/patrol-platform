import { message } from 'antd';

/**
 * Extract human-readable error message from Axios error response.
 * FastAPI/Pydantic validation errors (422) have detail as an array.
 */
export function getErrorMessage(error: any): string {
  const raw = error?.response?.data?.detail;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw.map((e: any) => {
      if (typeof e === 'string') return e;
      const loc = Array.isArray(e.loc) ? e.loc.join(' › ') : '';
      return loc ? `${loc}: ${e.msg}` : e.msg || String(e);
    }).join('；');
  }
  if (typeof raw === 'object' && raw !== null) {
    return raw.msg || JSON.stringify(raw);
  }
  return error?.message || '请求失败';
}

/**
 * Show error message from Axios error safely (handles array details).
 */
export function showError(error: any, fallback?: string): void {
  message.error(getErrorMessage(error) || fallback || '请求失败');
}
