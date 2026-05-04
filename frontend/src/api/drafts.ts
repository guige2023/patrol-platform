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

// 底稿操作
// - action === "submit"：提交草稿（操作员权限 draft:write）
// - 其他 action（preliminary_review/final_review/approve/reject）：审批动作（审批员权限 draft:approve）
export const submitDraft = (id: string, action: string, comment?: string) => {
  const endpoint = action === "submit" ? `/drafts/${id}/submit` : `/drafts/${id}/approve`;
  return api.post(endpoint, { action, comment });
};

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
