import api from './client';
import type { Draft, PaginationParams } from '@/types/api';

export const getDrafts = (params?: PaginationParams & { status?: string }) =>
  api.get('/drafts/', { params }).then(res => res.data);

export const getDraft = (id: string) =>
  api.get(`/drafts/${id}`).then(res => res.data);

export const createDraft = (data: Partial<Draft>) =>
  api.post('/drafts/', data).then(res => res.data);

export const updateDraft = (id: string, data: Partial<Draft>) =>
  api.put(`/drafts/${id}`, data).then(res => res.data);

export const submitDraft = (id: string, action: string, comment?: string) =>
  api.post(`/drafts/${id}/submit`, { action, comment });

export const deleteDraft = (id: string) =>
  api.delete(`/drafts/${id}`);

export const exportDrafts = (params?: { status?: string; category?: string }) => {
  return api.get('/drafts/download', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drafts.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const batchDeleteDrafts = (ids: string[]) =>
  api.post('/drafts/batch-delete', ids);
