import { create } from 'zustand';

interface RegisterSession {
  id: number;
  openFloat: number;
  openedAt: string;
}

interface RegisterState {
  session: RegisterSession | null;
  setSession: (session: RegisterSession | null) => void;
  clearSession: () => void;
}

export const useRegisterStore = create<RegisterState>((set) => ({
  session: null,

  setSession: (session) => {
    set({ session });
  },

  clearSession: () => {
    set({ session: null });
  },
}));
