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