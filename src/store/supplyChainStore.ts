import { create } from 'zustand';
import { 
  Supplier, 
  PurchaseOrder, 
  CreatePOPayload, 
  CheckInItemPayload 
} from '@/types/supplyChain';
import { SupplyChainService } from '@/services/supplyChainService';

interface SupplyChainState {
  suppliers: Supplier[];
  inTransitOrders: PurchaseOrder[];
  allOrders: PurchaseOrder[];
  isLoading: boolean;
  error: string | null;

  // Acciones
  fetchSuppliers: () => Promise<void>;
  fetchInTransitOrders: () => Promise<void>;
  createPurchaseOrder: (payload: CreatePOPayload) => Promise<PurchaseOrder>;
  confirmCheckIn: (poId: string, items: CheckInItemPayload[]) => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => Promise<Supplier>;
}

export const useSupplyChainStore = create<SupplyChainState>((set, get) => ({
  suppliers: [],
  inTransitOrders: [],
  allOrders: [],
  isLoading: false,
  error: null,

  fetchSuppliers: async () => {
    set({ isLoading: true, error: null });
    try {
      const suppliers = await SupplyChainService.getSuppliers();
      set({ suppliers, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchInTransitOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const orders = await SupplyChainService.getPurchaseOrdersByStatus('in_transit');
      set({ inTransitOrders: orders, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createPurchaseOrder: async (payload: CreatePOPayload) => {
    set({ isLoading: true, error: null });
    try {
      const newPO = await SupplyChainService.createPurchaseOrder(payload);
      
      // Mutación optimista si es en tránsito
      if (payload.status === 'in_transit') {
        get().fetchInTransitOrders();
      }

      set({ isLoading: false });
      return newPO;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  confirmCheckIn: async (poId: string, items: CheckInItemPayload[]) => {
    set({ isLoading: true, error: null });
    
    // Mutación optimista: Remover temporalmente la orden de inTransitOrders
    const previousOrders = get().inTransitOrders;
    set({
      inTransitOrders: previousOrders.filter(order => order.id !== poId)
    });

    try {
      await SupplyChainService.confirmCheckIn(poId, items);
      set({ isLoading: false });
    } catch (err: any) {
      // Revertir mutación si ocurre error
      set({ inTransitOrders: previousOrders, error: err.message, isLoading: false });
      throw err;
    }
  },

  addSupplier: async (supplierData) => {
    set({ isLoading: true, error: null });
    try {
      const newSupplier = await SupplyChainService.createSupplier(supplierData);
      set((state) => ({
        suppliers: [...state.suppliers, newSupplier],
        isLoading: false
      }));
      return newSupplier;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  }
}));
