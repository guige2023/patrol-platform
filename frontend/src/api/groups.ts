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
export const activateGroup = (id: string) =>
  api.post(`/groups/${id}/activate`);
export const completeGroup = (id: string) =>
  api.post(`/groups/${id}/complete`);
export const getGroupStatusLogs = (groupId: string) =>
  api.get(`/groups/${groupId}/status-logs`).then(res => res.data);
export const deleteGroup = (id: string) =>
  api.delete(`/groups/${id}`);

export const exportGroups = (params?: { plan_id?: string; status?: string; ids?: string }) => {
  return api.get('/groups/download', { params, responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'groups.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const batchDeleteGroups = (ids: string[]) =>
  api.post('/groups/batch-delete', ids);

export const getAvailableCadres = (planId: string) =>
  api.get(`/groups/available-cadres?plan_id=${planId}`).then(res => res.data);

export const autoMatchGroup = (planId: string, data: { leader_id: string; deputy_leader_ids: string[]; excluded_cadre_ids?: { cadre_id: string; reason: string }[] }) =>
  api.post('/groups/auto-match', { plan_id: planId, ...data }).then(res => res.data);

export const assignConcurrentRoles = (groupId: string, clueOfficerId?: string, liaisonOfficerId?: string) =>
  api.post(`/groups/${groupId}/concurrent-roles`, { clue_officer_id: clueOfficerId, liaison_officer_id: liaisonOfficerId });

export const getGroupPhaseLogs = (groupId: string) =>
  api.get(`/groups/${groupId}/phase-logs`).then(res => res.data);
