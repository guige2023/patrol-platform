import api from './client';

export interface Warning {
  id: string;
  type: string;
  title: string;
  description: string;
  source_id?: string;
  source_type?: string;
  is_read: boolean;
  created_at: string;
}

export const getWarnings = (params?: { is_read?: boolean; page?: number; page_size?: number }) =>
  api.get('/warnings/', { params }).then(res => res.data);

export const getUnreadWarningCount = () =>
  api.get('/warnings/unread-count').then(res => res.data);

export const markWarningAsRead = (id: string) =>
  api.post(`/warnings/${id}/read`);

export const markAllWarningsAsRead = () =>
  api.post('/warnings/read-all');

export const deleteWarning = (id: string) =>
  api.delete(`/warnings/${id}`);
