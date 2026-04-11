import api from './client';

export const getRectifications = (params?: { page?: number; page_size?: number; status?: string; unit_id?: string }) =>
  api.get('/rectifications/', { params }).then(res => res.data);

export const getRectification = (id: string) =>
  api.get(`/rectifications/${id}`).then(res => res.data);

export const createRectification = (data: any) =>
  api.post('/rectifications/', data).then(res => res.data);

export const updateRectification = (id: string, data: any) =>
  api.put(`/rectifications/${id}`, data).then(res => res.data);

export const updateProgress = (id: string, progress: number, details?: any[]) =>
  api.patch(`/rectifications/${id}/progress`, { progress, details });

export const signRectification = (id: string) =>
  api.post(`/rectifications/${id}/sign`);

export const verifyRectification = (id: string, comment?: string) =>
  api.post(`/rectifications/${id}/verify`, { comment });