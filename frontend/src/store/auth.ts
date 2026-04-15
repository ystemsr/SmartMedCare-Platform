import { create } from 'zustand';
import { getToken, setToken, removeToken } from '../utils/storage';
import { login as loginApi, getMe, logout as logoutApi } from '../api/auth';
import type { UserInfo, LoginRequest } from '../types/auth';

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  permissions: string[];
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  loadFromStorage: () => void;
}

/** Determine home route based on user roles */
export function getHomeRoute(roles: string[]): string {
  if (roles.includes('elder')) return '/elder';
  if (roles.includes('family')) return '/family';
  return '/dashboard';
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  permissions: [],

  login: async (credentials) => {
    const res = await loginApi(credentials);
    const { access_token } = res.data;
    setToken(access_token);
    set({ token: access_token });

    // Fetch full user info with permissions
    const meRes = await getMe();
    set({
      user: meRes.data,
      permissions: meRes.data.permissions || [],
    });
  },

  logout: async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore logout errors
    }
    removeToken();
    set({ user: null, token: null, permissions: [] });
  },

  fetchUser: async () => {
    const res = await getMe();
    set({
      user: res.data,
      permissions: res.data.permissions || [],
    });
  },

  loadFromStorage: () => {
    const token = getToken();
    set({ token });
  },
}));
