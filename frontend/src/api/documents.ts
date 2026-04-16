import api from './client';

export interface Document {
  id: string;
  title: string;
  doc_number?: string;
  type: string;
  generate_date?: string;
  generator?: string;
  file_url?: string;
  plan_id?: string;
  plan_name?: string;
  rectification_id?: string;
  created_at: string;
}

export const getDocuments = (params?: { type?: string; plan_id?: string; page?: number; page_size?: number }) =>
  api.get('/documents/', { params }).then(res => res.data);

export const getDocument = (id: string) =>
  api.get(`/documents/${id}`).then(res => res.data);

export const deleteDocument = (id: string) =>
  api.delete(`/documents/${id}`);

export const downloadDocument = (id: string) => {
  return api.get(`/documents/${id}/download`, { responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document_${id}`;
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const generateDocument = (planId: string, docType: string) =>
  api.post('/documents/generate', { plan_id: planId, doc_type: docType }).then(res => res.data);

export const generateRectificationNotice = (rectificationId: string) =>
  api.post('/documents/generate-rectification-notice', { rectification_id: rectificationId }).then(res => res.data);

export const previewDocument = (id: string) =>
  api.get(`/documents/${id}/preview`, { responseType: 'blob' });
