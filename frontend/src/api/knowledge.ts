import api from './client';
import { message } from 'antd';
import type { Knowledge, PaginationParams } from '@/types/api';

export const getKnowledgeList = (params?: PaginationParams & { title?: string; category?: string }) =>
  api.get('/knowledge/', { params }).then(res => res.data);

export const getKnowledge = (id: string) =>
  api.get(`/knowledge/${id}`).then(res => res.data.data);

export const getKnowledgeDetail = getKnowledge;

export const createKnowledge = (data: Partial<Knowledge>) =>
  api.post('/knowledge/', data).then(res => res.data);

export const updateKnowledge = (id: string, data: Partial<Knowledge>) =>
  api.put(`/knowledge/${id}`, data).then(res => res.data);

export const deleteKnowledge = (id: string) =>
  api.delete(`/knowledge/${id}`);

export const publishKnowledge = (id: string) =>
  api.post(`/knowledge/${id}/publish`);

export const getKnowledgeCategories = () =>
  api.get('/knowledge/knowledge-categories').then(res => res.data);

export const exportKnowledge = (params?: { category?: string }) => {
  return api.get('/knowledge/knowledge-export', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  }).catch((e: unknown) => {
    const err = e instanceof Error ? e : new Error('Unknown error');
    message.error('导出失败: ' + (err.message || '未知错误'));
    throw e;
  });
};
