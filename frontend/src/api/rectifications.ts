import api from './client';
import type { Rectification, PaginationParams } from '@/types/api';

export const getRectifications = (params?: PaginationParams & { status?: string; unit_id?: string; title?: string }) =>
  api.get('/rectifications/', { params }).then(res => res.data);

export const getRectification = (id: string) =>
  api.get(`/rectifications/${id}`).then(res => res.data);

export const createRectification = (data: Partial<Rectification>) =>
  api.post('/rectifications/', data).then(res => res.data);

export const updateRectification = (id: string, data: Partial<Rectification>) =>
  api.put(`/rectifications/${id}`, data).then(res => res.data);

export const updateRectificationProgress = (id: string, progress: number, details?: Record<string, unknown>[]) =>
  api.patch(`/rectifications/${id}/progress?progress=${progress}`, details ? { details } : undefined);

export const signRectification = (id: string) =>
  api.post(`/rectifications/${id}/sign`);

export const verifyRectification = (id: string, comment?: string) =>
  api.post(`/rectifications/${id}/verify`, { comment });

export const exportRectifications = (params?: { status?: string; alert_level?: string }) => {
  return api.get('/rectifications/download', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rectifications.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const deleteRectification = (id: string) =>
  api.delete(`/rectifications/${id}`);

export const batchDeleteRectifications = (ids: string[]) =>
  api.post('/rectifications/batch-delete', ids);

export const submitRectification = (id: string) =>
  api.post(`/rectifications/${id}/submit`);

export const batchUpdateRectificationStatus = (ids: string[], status: string) =>
  api.post('/rectifications/batch-status', { ids, status });

export const importRectifications = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/rectifications/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const confirmRectification = (id: string, isCompleted: boolean, notes?: string) =>
  api.post(`/rectifications/${id}/confirm`, { is_completed: isCompleted, notes });

export const rejectRectification = (id: string, reason: string) =>
  api.post(`/rectifications/${id}/reject`, { reason });

export const getRectificationAttachments = (id: string) =>
  api.get(`/rectifications/${id}/attachments`).then(res => res.data);

export const uploadRectificationAttachment = (id: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/rectifications/${id}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const deleteRectificationAttachment = (id: string, attachmentId: string) =>
  api.delete(`/rectifications/${id}/attachments/${attachmentId}`);

export const exportRectificationsByYear = (year?: number) => {
  return api.get('/rectifications/export', { 
    params: year ? { year } : {},
    responseType: 'blob' 
  }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = year ? `整改记录_${year}.xlsx` : '整改记录导出.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const exportSingleRectificationPdf = (id: string) => {
  return api.get(`/rectifications/${id}/export-pdf`, { responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `整改通知书_${id}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const reimportRectification = (id: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/rectifications/${id}/reimport`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const downloadRectificationTemplate = () => {
  return api.get('/rectifications/template', { responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '整改记录导入模板.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};
