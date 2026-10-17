import { create } from 'zustand';

interface OmnibarState {
  isOpen: boolean;
  initialQuery: string;
  openOmnibar: (initialQuery?: string) => void;
  closeOmnibar: () => void;
  toggleOmnibar: () => void;
}

export const useOmnibarStore = create<OmnibarState>((set) => ({
  isOpen: false,
  initialQuery: '',
  openOmnibar: (initialQuery = '') => set({ isOpen: true, initialQuery }),
  closeOmnibar: () => set({ isOpen: false, initialQuery: '' }),
  toggleOmnibar: () =>
    set((state) => ({
      isOpen: !state.isOpen,
      initialQuery: state.isOpen ? '' : state.initialQuery,
    })),
}));
