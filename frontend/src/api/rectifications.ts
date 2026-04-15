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
  api.patch(`/rectifications/${id}/progress?progress=${progress}`, details ? { details } : undefined);

export const signRectification = (id: string) =>
  api.post(`/rectifications/${id}/sign`);

export const verifyRectification = (id: string, comment?: string) =>
  api.post(`/rectifications/${id}/verify`, { comment });

export const exportRectifications = (params?: { status?: string; alert_level?: string }) => {
  return api.get('/rectifications/download', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rectifications.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const deleteRectification = (id: string) =>
  api.delete(`/rectifications/${id}`);

export const submitRectification = (id: string) =>
  api.post(`/rectifications/${id}/submit`);