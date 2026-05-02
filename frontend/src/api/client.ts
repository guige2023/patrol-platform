import axios from 'axios';
import { message } from 'antd';

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

api.interceptors.response.use(
  (response) => {
    // Backend wraps responses in {data: ..., message: ...} for single objects
    // and {data: {items, total, ...}} for paginated lists
    // Only unwrap if we detect the wrapper pattern
    const rd = response.data;
    if (rd && typeof rd === 'object' && !Array.isArray(rd) && 'data' in rd) {
      const d = (rd as any).data;
      // Paginated list: {data: {items, total, page, page_size}}
      if (typeof d === 'object' && d !== null && 'items' in d && 'total' in d) {
        response.data = d;
      }
      // Single object: {data: {...obj...}, message: '...'}
      // OR plain array: {data: [...]}
      // Both cases: return rd.data directly
      else if (d !== null) {
        response.data = d;
      }
    }
    return response;
  },
  (error) => {
    // Only remove token for auth-related 401 errors (invalid/expired token)
    // Don't remove token for permission denied or other 401s to avoid cascade failures
    if (error.response?.status === 401) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string' && (detail === 'Invalid token' || detail.includes('token') || detail.includes('expired'))) {
        localStorage.removeItem('token');
      }
    }
    // FastAPI validation errors (422) have detail as an array of validation issues
    const rawDetail = error.response?.data?.detail;
    let msg = '请求失败';
    if (typeof rawDetail === 'string') {
      msg = rawDetail;
    } else if (Array.isArray(rawDetail)) {
      // Pydantic validation error list: extract human-readable messages
      msg = rawDetail.map((e: any) => {
        if (typeof e === 'string') return e;
        const loc = Array.isArray(e.loc) ? e.loc.join(' › ') : '';
        return loc ? `${loc}: ${e.msg}` : e.msg || String(e);
      }).join('；');
    } else if (typeof rawDetail === 'object' && rawDetail !== null) {
      msg = rawDetail.msg || JSON.stringify(rawDetail);
    }
    message.error(msg);
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