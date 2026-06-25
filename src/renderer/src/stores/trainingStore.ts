import { create } from 'zustand';

interface TrainingState {
  isTrainingMode: boolean;
  enableTrainingMode: () => void;
  disableTrainingMode: () => void;
  toggleTrainingMode: () => void;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  isTrainingMode: false,

  enableTrainingMode: () => {
    set({ isTrainingMode: true });
    localStorage.setItem('pos_training_mode', 'true');
  },

  disableTrainingMode: () => {
    set({ isTrainingMode: false });
    localStorage.removeItem('pos_training_mode');
  },

  toggleTrainingMode: () => {
    if (get().isTrainingMode) {
      get().disableTrainingMode();
    } else {
      get().enableTrainingMode();
    }
  },
}));
