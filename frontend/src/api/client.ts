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
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Backend wraps responses in {data: payload, message: "..."}
    // List endpoints: payload = {items, total, page, page_size}
    // Single endpoints: payload = the entity object
    // Groups endpoint: returns raw array (no pagination)
    const rd = response.data;
    if (rd && typeof rd === 'object' && !Array.isArray(rd) && 'data' in rd) {
      const inner = (rd as any).data;
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        if ('items' in inner && 'total' in inner) {
          // Paginated list: {items, total, ...}
          response.data = inner;
        } else {
          // Single entity
          response.data = inner;
        }
      }
    }
    // For raw arrays (like groups list), response.data stays as-is
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
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