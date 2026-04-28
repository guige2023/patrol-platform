import api from './client';
import type { Clue, PaginationParams } from '@/types/api';

export const getClues = (params?: PaginationParams & { title?: string; status?: string; source?: string; category?: string; start_date?: string; end_date?: string }) =>
  api.get('/clues/', { params }).then(res => res.data);

export const getClue = (id: string) =>
  api.get(`/clues/${id}`).then(res => res.data);

export const createClue = (data: Partial<Clue>) =>
  api.post('/clues/', data).then(res => res.data);

export const updateClue = (id: string, data: Partial<Clue>) =>
  api.put(`/clues/${id}`, data).then(res => res.data);

export const transferClue = (id: string, target: string, comment?: string) =>
  api.post(`/clues/${id}/transfer`, { target, comment });

export const exportClues = (params?: { status?: string; source?: string; category?: string }) => {
  return api.get('/clues/download', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clues.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};
