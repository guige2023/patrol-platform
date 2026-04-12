import api from './client';

export const getKnowledgeList = (params?: { page?: number; page_size?: number; title?: string; category?: string }) =>
  api.get('/knowledge/', { params }).then(res => res.data);

export const getKnowledge = (id: string) =>
  api.get(`/knowledge/${id}/`).then(res => res.data);

export const getKnowledgeDetail = getKnowledge;

export const createKnowledge = (data: any) =>
  api.post('/knowledge/', data).then(res => res.data);

export const updateKnowledge = (id: string, data: any) =>
  api.put(`/knowledge/${id}`, data).then(res => res.data);

export const deleteKnowledge = (id: string) =>
  api.delete(`/knowledge/${id}`);

export const publishKnowledge = (id: string) =>
  api.post(`/knowledge/${id}/publish`);

export const getKnowledgeCategories = () =>
  api.get('/knowledge/categories').then(res => res.data);