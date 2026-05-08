import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
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
  (error) => {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const detail = (axiosError.response?.data as any)?.detail;

    // Auth errors: clear token
    if (status === 401) {
      const detailStr = typeof detail === 'string' ? detail : '';
      if (
        detailStr === 'Invalid token' ||
        detailStr.includes('token') ||
        detailStr.includes('expired')
      ) {
        localStorage.removeItem('token');
      }
    }

    // Format error message (but don't toast here — let caller handle it)
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
    (error as any).friendlyMessage = msg;

    // Only show toast if not suppressed
    if (suppressErrorCount > 0) {
      suppressErrorCount--;
    } else {
      // Dynamically import antd to avoid circular deps at module init
      import('antd').then(({ message }) => {
        message.error(msg);
      });
    }

    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string) => {
  localStorage.setItem('token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('token');
};

export default api;
