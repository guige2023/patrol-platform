import api from './client';

export const login = (username: string, password: string) =>
  api.post('/auth/login', { username, password }).then(res => res.data);

export const getMe = () =>
  api.get('/auth/me').then(res => res.data);

export const changePassword = (old_password: string, new_password: string) =>
  api.post('/auth/change-password', { old_password, new_password });