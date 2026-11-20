import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed: boolean) => set({ isSidebarCollapsed: collapsed }),
    }),
    {
      name: "polygraph-ui-storage",
      // Restored after mount (see MainDashboardLayout), not during the first render:
      // the server always renders the expanded sidebar, so reading localStorage
      // up front made the client's first render differ → React hydration error #418.
      skipHydration: true,
    }
  )
);
