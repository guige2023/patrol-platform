import api from './client';

export const getPlans = (params?: { page?: number; page_size?: number; name?: string; year?: number; status?: string }) =>
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

export const updatePlanStatus = (id: string, status: string) =>
  api.post(`/plans/${id}/status`, { status });

export const exportPlans = (params?: { year?: number; status?: string }) => {
  return api.get('/plans/download', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plans.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const exportSelectedPlans = (ids: string[]) => {
  return api.get('/plans/download', { params: { ids: ids.join(',') }, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plans_selected.xlsx';
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
    a.download = 'plan_template.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};