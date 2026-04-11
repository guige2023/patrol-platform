import api from './client';

export const getCadres = (params?: { page?: number; page_size?: number; name?: string; unit_id?: string }) =>
  api.get('/cadres/', { params }).then(res => res.data);

export const getCadre = (id: string) =>
  api.get(`/cadres/${id}`).then(res => res.data);

export const createCadre = (data: any) =>
  api.post('/cadres/', data).then(res => res.data);

export const updateCadre = (id: string, data: any) =>
  api.put(`/cadres/${id}`, data).then(res => res.data);

export const deleteCadre = (id: string) =>
  api.delete(`/cadres/${id}`);