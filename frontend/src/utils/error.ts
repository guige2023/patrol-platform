import type { ApiError, ValidationError } from '@/types/api';

/**
 * Notification interface — allows swapping the underlying notification
 * implementation (antd message, notification, custom toast, etc.).
 */
export interface NotificationService {
  error(content: string): void;
  success(content: string): void;
  warning(content: string): void;
  info(content: string): void;
}

/** Default: antd message */
let _notifier: NotificationService = {
  error: (content) => import('antd').then(({ message }) => message.error(content)),
  success: (content) => import('antd').then(({ message }) => message.success(content)),
  warning: (content) => import('antd').then(({ message }) => message.warning(content)),
  info: (content) => import('antd').then(({ message }) => message.info(content)),
}

/** Override notifier for testing or custom UI */
export function setNotificationService(ns: NotificationService): void {
  _notifier = ns
}

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
 * Show error notification.
 * NOTE: Automatic toast is handled by the client interceptor — use this only
 * when you need to suppress the automatic toast (e.g., background requests).
 */
export function showError(error: unknown, fallback?: string): void {
  _notifier.error(getErrorMessage(error) || fallback || '请求失败');
}

export function showSuccess(message: string): void {
  _notifier.success(message);
}
