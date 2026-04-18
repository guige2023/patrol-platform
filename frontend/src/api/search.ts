import api from './client';

export interface SearchResult {
  units?: { id: string; name: string; org_code: string }[];
  cadres?: { id: string; name: string; position?: string }[];
  knowledge?: { id: string; title: string; category?: string }[];
  drafts?: { id: string; title: string; status?: string }[];
}

export const globalSearch = (q: string, type?: string) =>
  api.get('/search/', { params: { q, type } }).then(res => res.data);