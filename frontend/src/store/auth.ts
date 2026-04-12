import { create } from 'zustand';
import { setAuthToken, clearAuthToken } from '@/api/client';
import { getMe } from '@/api/auth';

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  unit_id?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),

  login: async (username, password) => {
    const { login } = await import('@/api/auth');
    const res = await login(username, password);
    setAuthToken(res.access_token);
    localStorage.setItem('token', res.access_token);
    set({ user: res.user, token: res.access_token });
  },

  logout: () => {
    clearAuthToken();
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const user = await getMe();
      set({ user, token });
    } catch {
      clearAuthToken();
      set({ user: null, token: null });
    }
  },
}));