import api from './client'

export const getSystemConfigs = () => api.get('/system-configs/').then(res => res.data)
export const updateSystemConfig = (key: string, value: string) =>
  api.put(`/system-configs/${key}`, { value }).then(res => res.data)
