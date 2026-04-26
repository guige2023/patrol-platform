import api from './client';

export const getCadres = (params?: { page?: number; page_size?: number; name?: string; unit_id?: string }) =>
  api.get('/cadres/', { params }).then(res => (res.data as any)?.data ?? res.data);

// Backend returns {data: {cadre_fields}, message: "..."} for single-object GET.
// The response interceptor does NOT unwrap it (no items/total). Unwrap manually.
export const getCadre = (id: string) =>
  api.get(`/cadres/${id}`).then(res => (res.data as any).data);

export const getCadreDetail = getCadre;

export const createCadre = (data: any) =>
  api.post('/cadres/', data).then(res => res.data);

export const updateCadre = (id: string, data: any) =>
  api.put(`/cadres/${id}`, data).then(res => res.data);

export const deleteCadre = (id: string) =>
  api.delete(`/cadres/${id}`);

export const importCadres = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/cadres/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const downloadCadreTemplate = () => {
  return api.get('/cadres/template', { responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '干部人才导入模板.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const exportCadres = () =>
  api.get('/cadres/export', { responseType: 'blob' }).then(res => res.data);

export const getCadreGroups = (cadreId: string) =>
  api.get(`/cadres/${cadreId}/groups`).then(res => res.data);

export const batchDeleteCadres = (ids: string[]) =>
  api.post('/cadres/batch-delete', ids);
export const getCadreReport = (cadreId: string) =>
  api.get(`/cadres/${cadreId}/report`).then(res => res.data);
