import { create } from 'zustand';

interface User {
  id: number;
  clientId: number;
  firstName: string;
  lastName: string;
}

interface TerminalConfig {
  terminalId: number;
  terminalName: string;
  warehouseId: number;
  warehouseName: string;
  shelfId: number;
  shelfName: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  terminalConfig: TerminalConfig | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setTerminalConfig: (config: TerminalConfig) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  terminalConfig: null,

  setAuth: (token, user) => {
    set({ token, user });
    window.electronAPI.saveStoredToken(token);
  },

  clearAuth: () => {
    set({ token: null, user: null });
    window.electronAPI.saveStoredToken('');
  },

  setTerminalConfig: (config) => {
    set({ terminalConfig: config });
  },
}));
