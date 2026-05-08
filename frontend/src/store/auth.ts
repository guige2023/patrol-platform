import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { clearAuthToken } from '@/api/client';
import { getMe } from '@/api/auth';

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  unit_id?: string;
  permissions: string[];  // 合并所有角色的权限
}

// 权限检查工具函数
export const hasPermission = (user: User | null, permission: string): boolean => {
  if (!user) return false;
  const { permissions } = user;
  if (permissions.includes("*")) return true;
  return permissions.includes(permission);
};

export const hasAnyPermission = (user: User | null, perms: string[]): boolean => {
  if (!user) return false;
  if (user.permissions.includes("*")) return true;
  return perms.some(p => user.permissions.includes(p));
};

interface AuthState {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
  user: null,
  token: localStorage.getItem('token'),

  login: async (username, password) => {
    const { login } = await import('@/api/auth');
    const res = await login(username, password);
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
}),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);