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
      // Don't navigate here — let the next component/auth-check handle redirect
    }
    const msg = error.response?.data?.detail || error.message || '请求失败';
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