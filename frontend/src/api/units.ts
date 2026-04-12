import api from './client';

export const getUnits = (params?: { page?: number; page_size?: number; name?: string }) =>
  api.get('/units/', { params }).then(res => res.data);

export const getUnitTree = () =>
  api.get('/units/tree').then(res => res.data);

export const getUnit = (id: string) =>
  api.get(`/units/${id}/`).then(res => res.data);

export const getUnitDetail = getUnit;

export const createUnit = (data: any) =>
  api.post('/units/', data).then(res => res.data);

export const updateUnit = (id: string, data: any) =>
  api.put(`/units/${id}`, data).then(res => res.data);

export const deleteUnit = (id: string) =>
  api.delete(`/units/${id}`);

export const importUnits = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/units/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const exportUnits = () => {
  return api.get('/units/export', {
    responseType: 'blob',
  }).then(res => {
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '单位档案.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};