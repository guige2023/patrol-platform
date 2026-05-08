import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
  withCredentials: true,  // Send httpOnly cookies to backend for XSS protection
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn(`[API] No token for ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

// Track which requests should suppress error toast (e.g., background polling)
let suppressErrorCount = 0;
export const suppressNextErrorToast = () => { suppressErrorCount++; };
export const resetSupressErrorToast = () => { suppressErrorCount = 0; };

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;

    // Auth errors: clear token on 401/403
    if (status === 401 || status === 403) {
      localStorage.removeItem('token');
    }

    // Format error message
    const detail = (axiosError.response?.data as any)?.detail;
    let msg = '请求失败';
    if (typeof detail === 'string') {
      msg = detail;
    } else if (Array.isArray(detail)) {
      msg = detail.map((e: any) => {
        if (typeof e === 'string') return e;
        const loc = Array.isArray(e.loc) ? e.loc.join(' › ') : '';
        return loc ? `${loc}: ${e.msg}` : e.msg || String(e);
      }).join('；');
    } else if (typeof detail === 'object' && detail !== null) {
      msg = (detail as any).msg || JSON.stringify(detail);
    }

    // Attach formatted message to error for callers to handle
    (axiosError as any).friendlyMessage = msg;

    // Only show toast if not suppressed
    if (suppressErrorCount > 0) {
      suppressErrorCount--;
    } else {
      import('antd').then(({ message }) => {
        message.error(msg);
      });
    }

    return Promise.reject(axiosError);
  }
);

export const setAuthToken = (token: string) => {
  localStorage.setItem('token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('token');
};

export default api;
