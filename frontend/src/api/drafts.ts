import api from './client';

export const getDrafts = (params?: { page?: number; page_size?: number; status?: string }) =>
  api.get('/drafts/', { params }).then(res => res.data);

export const getDraft = (id: string) =>
  api.get(`/drafts/${id}`).then(res => res.data);

export const createDraft = (data: any) =>
  api.post('/drafts/', data).then(res => res.data);

export const updateDraft = (id: string, data: any) =>
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