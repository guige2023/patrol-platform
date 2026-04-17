import api from './client';

export const getKnowledgeList = (params?: { page?: number; page_size?: number; title?: string; category?: string }) =>
  api.get('/knowledge/', { params }).then(res => res.data);

// Backend returns {data: {knowledge_fields}, message: "..."} for single-object GET.
// The response interceptor does NOT unwrap it (no items/total). Unwrap manually.
export const getKnowledge = (id: string) =>
  api.get(`/knowledge/${id}`).then(res => (res.data as any).data);

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

export const exportKnowledge = (params?: { category?: string }) => {
  return api.get('/knowledge/download', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};