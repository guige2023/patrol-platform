import api from './client';

export const getUsers = () => api.get('/admin/users').then(res => res.data);
export const createUser = (data: any) => api.post('/admin/users', data).then(res => res.data);
export const updateUser = (id: string, data: any) => api.put(`/admin/users/${id}`, data).then(res => res.data);
export const deleteUser = (id: string) => api.delete(`/admin/users/${id}`);
export const getAuditLogs = (params?: { page?: number; page_size?: number; entity_type?: string; search?: string }) =>
  api.get('/admin/audit-logs', { params }).then(res => res.data);
export const getModules = () => api.get('/admin/modules').then(res => res.data);
export const updateModule = (id: string, is_enabled: boolean, config?: any) =>
  api.put(`/admin/modules/${id}`, { is_enabled, config }).then(res => res.data);
export const getAlerts = (params?: { is_resolved?: boolean; level?: string }) =>
  api.get('/alerts/', { params }).then(res => res.data);
export const resolveAlert = (id: string) => api.post(`/alerts/${id}/resolve`);
export const getNotifications = (params?: { is_read?: boolean }) =>
  api.get('/notifications/', { params }).then(res => res.data);
export const markNotificationRead = (id: string) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('/notifications/read-all');
export const uploadFile = (file: File, entity_type?: string, entity_id?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (entity_type) formData.append('entity_type', entity_type);
  if (entity_id) formData.append('entity_id', entity_id);
  return api.post('/files/upload', formData).then(res => res.data);
};

export const exportAuditLogs = (params?: { entity_type?: string }) => {
  return api.get('/admin/audit-logs/download', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit_logs.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const getRoles = () => api.get('/admin/roles').then(res => res.data);

export const createRole = (data: any) => api.post('/admin/roles', data);

export const updateRole = (id: string, data: any) => api.put(`/admin/roles/${id}`, data);

export const deleteRole = (id: string) => api.delete(`/admin/roles/${id}`);

export const getPermissions = () => api.get('/admin/permissions').then(res => res.data);
