import api from './client';

export interface BackupRecord {
  id: string;
  filename: string;
  type: 'auto' | 'manual';
  size: number;
  created_at: string;
}

export const getBackups = () =>
  api.get('/backup/').then(res => res.data);

export const createBackup = () =>
  api.post('/backup/').then(res => res.data);

export const restoreBackup = (id: string) =>
  api.post(`/backup/${id}/restore`).then(res => res.data);

export const deleteBackup = (id: string) =>
  api.delete(`/backup/${id}`);

export const downloadBackup = (id: string) => {
  return api.get(`/backup/${id}/download`, { responseType: 'blob' }).then(res => {
    const blob = new Blob([res.data], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${id}`;
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const getBackupSettings = () =>
  api.get('/backup/settings/').then(res => res.data);

export const updateBackupSettings = (enabled: boolean, cron?: string) =>
  api.put('/backup/settings/', { auto_backup_enabled: enabled, cron_expression: cron }).then(res => res.data);
