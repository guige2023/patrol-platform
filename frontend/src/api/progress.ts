import api from './client';

export interface ProgressRecord {
  id: string;
  plan_id: string;
  plan_name?: string;
  group_id?: string;
  group_name?: string;
  week_number: number;
  report_date: string;
  talk_count: number;
  doc_review_count: number;
  petition_count: number;
  visit_count: number;
  problem_total: number;
  problem_party: number;
  problem_pty: number;
  problem_key: number;
  next_week_plan: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const getProgressList = (params?: { plan_id?: string; group_id?: string; page?: number; page_size?: number }) =>
  api.get('/progress/', { params }).then(res => res.data);

// Backend returns {data: {progress_fields}, message: "..."} — manual unwrap needed.
export const getProgress = (id: string) =>
  api.get(`/progress/${id}`).then(res => (res.data as any).data);

export const createProgress = (data: any) =>
  api.post('/progress/', data).then(res => res.data);

export const updateProgress = (id: string, data: any) =>
  api.put(`/progress/${id}`, data).then(res => res.data);

export const deleteProgress = (id: string) =>
  api.delete(`/progress/${id}`);

export const importProgress = (planId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/progress/import/${planId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data);
};

export const downloadProgressTemplate = (planId?: string) => {
  return api.get('/progress/template', { 
    params: planId ? { plan_id: planId } : {},
    responseType: 'blob' 
  }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '巡察进度导入模板.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const exportProgress = (params?: { plan_id?: string; group_id?: string; year?: number }) => {
  return api.get('/progress/export', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '巡察进度导出.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};
