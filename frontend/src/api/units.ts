import api from './client';

export const getUnits = (params?: { page?: number; page_size?: number; name?: string }) =>
  api.get('/units/', { params }).then(res => res.data);

export const getUnitTree = () =>
  api.get('/units/tree').then(res => res.data);

export const getUnit = (id: string) =>
  api.get(`/units/${id}`).then(res => res.data);

export const createUnit = (data: any) =>
  api.post('/units/', data).then(res => res.data);

export const updateUnit = (id: string, data: any) =>
  api.put(`/units/${id}`, data).then(res => res.data);

export const deleteUnit = (id: string) =>
  api.delete(`/units/${id}`);