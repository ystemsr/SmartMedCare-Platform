import { create } from 'zustand';

interface AppState {
  sidebarCollapsed: boolean;
  loading: boolean;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  loading: false,

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setLoading: (loading) => set({ loading }),
}));
