import api from './client';

export const getClues = (params?: { page?: number; page_size?: number; title?: string; status?: string; source?: string }) =>
  api.get('/clues/', { params }).then(res => res.data);
export const getClue = (id: string) =>
  api.get(`/clues/${id}`).then(res => res.data);
export const createClue = (data: any) =>
  api.post('/clues/', data).then(res => res.data);
export const updateClue = (id: string, data: any) =>
  api.put(`/clues/${id}`, data).then(res => res.data);
export const transferClue = (id: string, target: string, comment?: string) =>
  api.post(`/clues/${id}/transfer`, { target, comment });
