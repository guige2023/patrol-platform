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

export const exportPlans = (params?: { year?: number; status?: string }) => {
  return api.get('/plans/export', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '巡察计划导出.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const downloadPlanTemplate = () => {
  return api.get('/plans/template', { responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '巡察计划导入模板.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};