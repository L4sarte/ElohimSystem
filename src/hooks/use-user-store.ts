import { create } from 'zustand';
import { UserRole } from '@/types';

interface UserState {
  role: UserRole;
  setRole: (role: UserRole) => void;
  // Estados para sincronización de cotización del Dólar Blue en tiempo real en toda la UI
  exchangeRate: number | null;
  isRateManual: boolean;
  setExchangeRate: (rate: number | null, isManual: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  role: 'admin',
  setRole: (role) => set({ role }),
  exchangeRate: null,
  isRateManual: false,
  setExchangeRate: (rate, isManual) => set({ exchangeRate: rate, isRateManual: isManual }),
}));
