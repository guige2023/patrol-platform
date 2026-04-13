import api from './client';

export const getGroups = (params?: { plan_id?: string; status?: string }) =>
  api.get('/groups/', { params }).then(res => res.data);
export const getGroup = (id: string) =>
  api.get(`/groups/${id}`).then(res => res.data);
export const createGroup = (data: { name: string; plan_id: string; target_unit_id?: string }) =>
  api.post('/groups/', data).then(res => res.data);
export const updateGroup = (id: string, data: any) =>
  api.put(`/groups/${id}`, data).then(res => res.data);
export const addMember = (groupId: string, cadreId: string, role: string) =>
  api.post(`/groups/${groupId}/members`, { cadre_id: cadreId, role, is_leader: role === '组长' }).then(res => res.data);
export const removeMember = (groupId: string, cadreId: string) =>
  api.delete(`/groups/${groupId}/members/${cadreId}`);
export const getGroupMembers = (groupId: string) =>
  api.get(`/groups/${groupId}/members`).then(res => res.data);
export const submitGroup = (id: string) =>
  api.post(`/groups/${id}/submit`);
