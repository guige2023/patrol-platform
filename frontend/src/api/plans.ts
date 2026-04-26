import api from './client';

export const getPlanYears = () =>
  api.get('/plans/years').then((res: any) => res.data?.data ?? []);
import { message } from 'antd';

export const getPlans = (params?: { page?: number; page_size?: number; name?: string; year?: number; status?: string; principal_id?: string }) =>
  api.get('/plans/', { params }).then(res => (res.data as any)?.data ?? res.data);

// Backend returns {data: {plan_fields}, message: "..."} for single-object GET.
// The response interceptor does NOT unwrap it (no items/total). Unwrap manually.
export const getPlan = (id: string) =>
  api.get(`/plans/${id}`).then(res => (res.data as any).data);

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

export const exportPlanReport = (planId: string, planName?: string) => {
  api.get(`/plans/${planId}/report`, { responseType: 'blob' })
    .then(res => {
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = planName ? `${planName}_完整报告.xlsx` : '巡察完整报告.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(() => message.error('导出报告失败'));
};

export const exportPlanChecklist = (planId: string, planName?: string) => {
  api.get(`/plans/${planId}/checklist`, { responseType: 'blob' })
    .then(res => {
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = planName ? `${planName}_检查清单.pdf` : '巡察检查清单.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(() => message.error('导出检查清单失败'));
};