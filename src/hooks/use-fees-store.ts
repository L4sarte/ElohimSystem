import { create } from 'zustand';
import { getActivePaymentMethods, PaymentMethodConfig } from '@/app/actions/fees';

interface FeesState {
  activeMethods: PaymentMethodConfig[];
  loading: boolean;
  error: string | null;
  fetchActiveMethods: () => Promise<void>;
}

export const useFeesStore = create<FeesState>((set) => ({
  activeMethods: [],
  loading: false,
  error: null,
  fetchActiveMethods: async () => {
    set({ loading: true, error: null });
    try {
      const res = await getActivePaymentMethods();
      if (res.success && res.data) {
        set({ activeMethods: res.data, loading: false });
      } else {
        set({ error: res.error || 'Error al cargar comisiones', loading: false });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con comisiones';
      set({ error: msg, loading: false });
    }
  },
}));
