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

export const batchDeleteRectifications = (ids: string[]) =>
  api.post('/rectifications/batch-delete', ids);

export const submitRectification = (id: string) =>
  api.post(`/rectifications/${id}/submit`);
export const batchUpdateRectificationStatus = (ids: string[], status: string) =>
  api.post('/rectifications/batch-status', { ids, status });

export const importRectifications = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/rectifications/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const confirmRectification = (id: string, isCompleted: boolean, notes?: string) =>
  api.post(`/rectifications/${id}/confirm`, { is_completed: isCompleted, notes });

export const exportRectificationsByYear = (year?: number) => {
  return api.get('/rectifications/export', { 
    params: year ? { year } : {},
    responseType: 'blob' 
  }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = year ? `整改记录_${year}.xlsx` : '整改记录导出.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const exportSingleRectificationPdf = (id: string) => {
  return api.get(`/rectifications/${id}/export-pdf`, { responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `整改通知书_${id}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const reimportRectification = (id: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/rectifications/${id}/reimport`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const downloadRectificationTemplate = () => {
  return api.get('/rectifications/template', { responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '整改记录导入模板.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};
