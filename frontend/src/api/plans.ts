import api from './client';

export const getPlans = (params?: { page?: number; page_size?: number; year?: number; status?: string }) =>
  api.get('/plans/', { params }).then(res => res.data);

export const getPlan = (id: string) =>
  api.get(`/plans/${id}`).then(res => res.data);

export const createPlan = (data: any) =>
  api.post('/plans/', data).then(res => res.data);

export const updatePlan = (id: string, data: any) =>
  api.put(`/plans/${id}`, data).then(res => res.data);

export const submitPlan = (id: string) =>
  api.post(`/plans/${id}/submit`);

export const approvePlan = (id: string, comment?: string) =>
  api.post(`/plans/${id}/approve`, { comment });

export const publishPlan = (id: string) =>
  api.post(`/plans/${id}/publish`);

export const deletePlan = (id: string) =>
  api.delete(`/plans/${id}`);