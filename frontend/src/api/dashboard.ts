import api from './client';

export const getOverview = () =>
  api.get('/dashboard/overview').then(res => res.data);

export const getIssueProfile = () =>
  api.get('/dashboard/issues').then(res => res.data);